import { BRAND_NAME } from "@cap/utils/brand";
import {
	Body,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Preview,
	Section,
	Tailwind,
	Text,
} from "@react-email/components";
import { emailLogoUrl } from "./brand";
import FooterEs from "./components/FooterEs";

export function SignupRequestReceived({ email = "" }: { email: string }) {
	return (
		<Html>
			<Head />
			<Preview>Recibimos tu solicitud de acceso</Preview>
			<Tailwind>
				<Body className="mx-auto my-auto bg-gray-1 font-sans">
					<Container className="mx-auto my-10 max-w-[500px] rounded border border-solid border-gray-200 px-10 py-5">
						<Section className="mt-8">
							<Img
								src={emailLogoUrl()}
								width="120"
								alt={BRAND_NAME}
								className="mx-auto my-0"
							/>
						</Section>
						<Heading className="mx-0 my-7 p-0 text-center text-xl font-semibold text-black">
							Recibimos tu solicitud de acceso
						</Heading>
						<Text className="text-sm leading-6 text-black">Hola,</Text>
						<Text className="text-sm leading-6 text-black">
							Gracias por tu interés en Zellia Clips. El equipo de Whitelabel
							revisará tu solicitud.
						</Text>
						<Text className="text-sm leading-6 text-black">
							Si la aprueban, recibirás una invitación por correo para crear tu
							cuenta. No necesitas hacer nada más por ahora.
						</Text>
						<FooterEs email={email} />
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
}
