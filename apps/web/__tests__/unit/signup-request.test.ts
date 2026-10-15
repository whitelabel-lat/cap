import { render } from "@react-email/components";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	sendEmail: vi.fn<(args: SentEmail) => Promise<unknown>>(),
}));

type SentEmail = {
	email: string;
	subject: string;
	react: React.ReactElement;
};

const env = vi.hoisted(() => ({
	CAP_SIGNUP_REQUEST_NOTIFY_EMAIL: "hola@whitelabel.lat" as string | undefined,
	WEB_URL: "https://loom.whitelabel.lat",
}));

vi.mock("@cap/env", () => ({
	serverEnv: () => env,
	buildEnv: {
		NEXT_PUBLIC_IS_CAP: false,
		NEXT_PUBLIC_WEB_URL: "https://clips.example.com",
	},
}));
vi.mock("@cap/database/emails/config", () => ({
	sendEmail: mocks.sendEmail,
}));

import {
	notifySignupRequest,
	resetSignupRequestThrottle,
} from "@cap/database/auth/signup-request";

const NOW = new Date("2026-10-14T15:30:00Z"); // 10:30 in Bogota
const HOUR = 60 * 60 * 1000;

const request = (
	over: Partial<Parameters<typeof notifySignupRequest>[0]> = {},
) =>
	notifySignupRequest({
		email: "Ext@Gmail.com",
		name: "Ana Externa",
		method: "google",
		now: NOW,
		...over,
	});

const recipients = () => mocks.sendEmail.mock.calls.map(([a]) => a.email);

beforeEach(() => {
	resetSignupRequestThrottle();
	env.CAP_SIGNUP_REQUEST_NOTIFY_EMAIL = "hola@whitelabel.lat";
	mocks.sendEmail.mockReset().mockResolvedValue({ data: { id: "x" } });
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("notifySignupRequest", () => {
	it("sends the team notification and the person's confirmation once", async () => {
		await request();

		expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
		expect(recipients().sort()).toEqual([
			"ext@gmail.com",
			"hola@whitelabel.lat",
		]);
	});

	it("puts who, when, how and the members link in the team email", async () => {
		await request({ name: "Ana Externa", method: "google" });
		const team = mocks.sendEmail.mock.calls
			.map(([a]) => a)
			.find((a) => a.email === "hola@whitelabel.lat");
		if (!team) throw new Error("no team email");

		expect(team.subject).toBe(
			"Solicitud de acceso a Zellia Clips: ext@gmail.com",
		);
		const html = await render(team.react);
		expect(html).toContain("ext@gmail.com");
		expect(html).toContain("Ana Externa");
		expect(html).toContain("Google");
		expect(html).toContain("10:30");
		expect(html).toContain("Bogotá");
		expect(html).toContain(
			'href="https://loom.whitelabel.lat/dashboard/settings/organization/members"',
		);
		expect(html).toContain(
			"Si lo autorizan, invítenlo desde Miembros; podrá registrarse con ese correo.",
		);
	});

	it.each([
		["google", "Google"],
		["apple", "Apple"],
		["email", "Código por email"],
		["mobile", "App móvil"],
	] as const)("labels the %s sign-in method", async (method, label) => {
		await request({ method });
		const team = mocks.sendEmail.mock.calls
			.map(([a]) => a)
			.find((a) => a.email === "hola@whitelabel.lat");
		expect(await render((team as SentEmail).react)).toContain(label);
	});

	it("escapes user-provided values in the team email", async () => {
		await request({ name: '<img src=x onerror="alert(1)">' });
		const team = mocks.sendEmail.mock.calls
			.map(([a]) => a)
			.find((a) => a.email === "hola@whitelabel.lat");
		const html = await render((team as SentEmail).react);

		expect(html).not.toContain("<img src=x");
		expect(html).toContain("&lt;img");
	});

	it("tells the person the team will review it, with no action links", async () => {
		await request();
		const person = mocks.sendEmail.mock.calls
			.map(([a]) => a)
			.find((a) => a.email === "ext@gmail.com");
		if (!person) throw new Error("no person email");

		expect(person.subject).toBe("Recibimos tu solicitud de acceso");
		const html = await render(person.react);
		expect(html).toContain("revisará tu solicitud");
		expect(html).toContain("invitación por correo");
		expect(html).not.toContain("<a ");
	});

	it("does not email again for the same address within 24 hours", async () => {
		await request();
		mocks.sendEmail.mockClear();

		await request({
			email: " EXT@gmail.com ",
			now: new Date(+NOW + 23 * HOUR),
		});

		expect(mocks.sendEmail).not.toHaveBeenCalled();
	});

	it("emails again once 24 hours have passed", async () => {
		await request();
		mocks.sendEmail.mockClear();

		await request({ now: new Date(+NOW + 24 * HOUR + 1) });

		expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
	});

	it("caps the notifications per hour globally and only warns beyond it", async () => {
		for (let i = 0; i < 20; i++) await request({ email: `u${i}@gmail.com` });
		expect(mocks.sendEmail).toHaveBeenCalledTimes(40);
		mocks.sendEmail.mockClear();

		await request({ email: "late@gmail.com" });

		expect(mocks.sendEmail).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalled();

		await request({
			email: "later@gmail.com",
			now: new Date(+NOW + HOUR + 1),
		});
		expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
	});

	it("sends only the person's email when the notify address is unset", async () => {
		env.CAP_SIGNUP_REQUEST_NOTIFY_EMAIL = undefined;

		await request();

		expect(recipients()).toEqual(["ext@gmail.com"]);
	});

	it.each(["", "Equipo <hola@whitelabel.lat>", "a@x.com,b@x.com"])(
		"skips the team email when the notify address is %j",
		async (value) => {
			env.CAP_SIGNUP_REQUEST_NOTIFY_EMAIL = value;

			await request();

			expect(recipients()).toEqual(["ext@gmail.com"]);
		},
	);

	it("never rejects when sending throws or Resend returns an error", async () => {
		mocks.sendEmail.mockRejectedValueOnce(new Error("boom"));
		mocks.sendEmail.mockResolvedValueOnce({ error: { message: "nope" } });

		await expect(request()).resolves.toBeUndefined();
		expect(console.error).toHaveBeenCalled();
	});

	it("ignores addresses that are not a plain email", async () => {
		await request({ email: "a@b.com\r\nBcc: x@y.com" });
		await request({ email: "not-an-email" });

		expect(mocks.sendEmail).not.toHaveBeenCalled();
	});
});
