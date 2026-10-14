// whitelabel fork: when CAP_ALLOWED_SIGNUP_DOMAINS refuses a new person, tell
// the team (CAP_SIGNUP_REQUEST_NOTIFY_EMAIL) and acknowledge the person.
//
// Abuse protection: with the email provider the sign-in callback runs on the
// code request, before the requester has proven they own the address, so
// anyone could make us mail arbitrary people. We therefore allow at most ONE
// notification pair per address per 24h and 20 pairs per hour overall; beyond
// that we only log. State is in memory on purpose (no migration): production
// runs a single web instance, and a restart merely resets the counters.
//
// Delivery is fire-and-forget: callers do `void notifySignupRequest(...)`. The
// refusal must never wait for Resend nor change if mail fails, so the function
// resolves (never rejects) and logs failures. A single long-lived Node
// process, as in production, lets the pending sends finish after the response.
import { serverEnv } from "@cap/env";
import { sendEmail } from "../emails/config.ts";

export type SignupRequestMethod =
	| "google"
	| "apple"
	| "email"
	| "mobile"
	| "sso";

const PER_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_MAX_PER_WINDOW = 20;
const TIME_ZONE = "America/Bogota";
const PLAIN_EMAIL = /^[^\s@<>",;]+@[^\s@<>",;]+\.[^\s@<>",;]+$/;

const METHOD_LABELS: Record<SignupRequestMethod, string> = {
	google: "Google",
	apple: "Apple",
	email: "Código por email",
	mobile: "App móvil",
	sso: "Inicio de sesión único (SSO)",
};

const lastNotifiedByEmail = new Map<string, number>();
let globalSends: number[] = [];

export function resetSignupRequestThrottle() {
	lastNotifiedByEmail.clear();
	globalSends = [];
}

export function signupMethodFromProvider(
	provider: string | undefined | null,
): SignupRequestMethod {
	if (provider === "google" || provider === "apple" || provider === "email")
		return provider;
	if (provider === "workos") return "sso";
	return "email";
}

/** Returns true and records the slot when a new notification pair may go out. */
function reserveSlot(email: string, nowMs: number): boolean {
	for (const [key, at] of lastNotifiedByEmail) {
		if (nowMs - at >= PER_EMAIL_WINDOW_MS) lastNotifiedByEmail.delete(key);
	}
	const last = lastNotifiedByEmail.get(email);
	if (last !== undefined && nowMs - last < PER_EMAIL_WINDOW_MS) return false;

	globalSends = globalSends.filter((at) => nowMs - at < GLOBAL_WINDOW_MS);
	if (globalSends.length >= GLOBAL_MAX_PER_WINDOW) {
		console.warn(
			`Signup request notifications capped (${GLOBAL_MAX_PER_WINDOW}/hour); not emailing for ${email}`,
		);
		return false;
	}

	lastNotifiedByEmail.set(email, nowMs);
	globalSends.push(nowMs);
	return true;
}

async function deliver(
	label: string,
	send: () => Promise<unknown> | undefined,
): Promise<void> {
	try {
		const result = await send();
		const error =
			result && typeof result === "object" && "error" in result
				? (result as { error?: unknown }).error
				: null;
		if (error) console.error(`Signup request email (${label}) failed`, error);
	} catch (error) {
		console.error(`Signup request email (${label}) failed`, error);
	}
}

export async function notifySignupRequest({
	email: rawEmail,
	name,
	method,
	now = new Date(),
}: {
	email: string;
	name?: string | null;
	method: SignupRequestMethod;
	now?: Date;
}): Promise<void> {
	try {
		const email = rawEmail.trim().toLowerCase();
		if (!PLAIN_EMAIL.test(email)) return;
		if (!reserveSlot(email, now.getTime())) return;

		const env = serverEnv();
		const configuredNotify = env.CAP_SIGNUP_REQUEST_NOTIFY_EMAIL?.trim();
		const notifyEmail =
			configuredNotify && PLAIN_EMAIL.test(configuredNotify)
				? configuredNotify
				: null;
		if (configuredNotify && !notifyEmail)
			console.warn(
				"CAP_SIGNUP_REQUEST_NOTIFY_EMAIL is not a plain email; team notice skipped",
			);
		const displayName =
			name?.trim() && name.trim() !== email ? name.trim() : null;

		const [{ SignupRequestNotification }, { SignupRequestReceived }] =
			await Promise.all([
				import("../emails/signup-request-notification.tsx"),
				import("../emails/signup-request-received.tsx"),
			]);

		const sends: Promise<void>[] = [
			deliver("requester", () =>
				sendEmail({
					email,
					subject: "Recibimos tu solicitud de acceso",
					react: SignupRequestReceived({ email }),
				}),
			),
		];

		if (notifyEmail) {
			const whenLabel = `${new Intl.DateTimeFormat("es-CO", {
				timeZone: TIME_ZONE,
				dateStyle: "full",
				timeStyle: "short",
				hour12: false,
			}).format(now)} (hora de Bogotá)`;
			const membersUrl = `${env.WEB_URL.replace(/\/+$/, "")}/dashboard/settings/organization/members`;
			sends.push(
				deliver("team", () =>
					sendEmail({
						email: notifyEmail,
						subject: `Solicitud de acceso a Loom: ${email}`,
						react: SignupRequestNotification({
							notifyEmail,
							requesterEmail: email,
							requesterName: displayName,
							methodLabel: METHOD_LABELS[method],
							whenLabel,
							membersUrl,
						}),
					}),
				),
			);
		}

		await Promise.all(sends);
	} catch (error) {
		console.error("Signup request notification failed", error);
	}
}
