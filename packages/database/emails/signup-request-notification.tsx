import { CAP_LOGO_URL } from "@cap/utils";
import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import FooterEs from "./components/FooterEs";

// React escapes every interpolated value, so nothing the requester controls
// (name, email) can inject markup.
export function SignupRequestNotification({
	notifyEmail = "",
	requesterEmail = "",
	requesterName = null,
	methodLabel = "",
	whenLabel = "",
	membersUrl = "",
}: {
	notifyEmail: string;
	requesterEmail: string;
	requesterName?: string | null;
	methodLabel: string;
	whenLabel: string;
	membersUrl: string;
}) {
	return (
		<Html>
			<Head />
			<Preview>Solicitud de acceso a Loom: {requesterEmail}</Preview>
			<Tailwind>
				<Body className="mx-auto my-auto bg-gray-1 font-sans">
					<Container className="mx-auto my-10 max-w-[500px] rounded border border-solid border-gray-200 px-10 py-5">
						<Section className="mt-8">
							<Img
								src={CAP_LOGO_URL}
								width="40"
								height="40"
								alt="Loom"
								className="mx-auto my-0"
							/>
						</Section>
						<Heading className="mx-0 my-7 p-0 text-center text-xl font-semibold text-black">
							Nueva solicitud de acceso
						</Heading>
						<Text className="text-sm leading-6 text-black">
							Alguien sin invitación intentó crear una cuenta en Loom y fue
							rechazado automáticamente.
						</Text>
						<Section className="my-4 rounded border border-solid border-gray-200 px-4 py-2">
							<Text className="my-1 text-sm leading-6 text-black">
								<strong>Correo:</strong> {requesterEmail}
							</Text>
							{requesterName ? (
								<Text className="my-1 text-sm leading-6 text-black">
									<strong>Nombre:</strong> {requesterName}
								</Text>
							) : null}
							<Text className="my-1 text-sm leading-6 text-black">
								<strong>Cuándo:</strong> {whenLabel}
							</Text>
							<Text className="my-1 text-sm leading-6 text-black">
								<strong>Método:</strong> {methodLabel}
							</Text>
						</Section>
						<Text className="text-sm leading-6 text-black">
							Si lo autorizan, invítenlo desde Miembros; podrá registrarse con
							ese correo.
						</Text>
						<Section className="my-8 text-center">
							<Link
								className="rounded-full bg-black px-6 py-3 text-center text-[12px] font-semibold text-white no-underline"
								href={membersUrl}
							>
								Abrir Miembros
							</Link>
						</Section>
						<FooterEs email={notifyEmail} />
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
