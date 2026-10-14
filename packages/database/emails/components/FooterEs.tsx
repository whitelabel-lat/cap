import { Hr, Tailwind, Text } from "@react-email/components";

export default function FooterEs({ email }: { email: string }) {
	return (
		<Tailwind>
			<Hr className="mx-0 my-6 w-full border border-gray-200" />
			<Text className="text-[12px] leading-6 text-gray-500">
				Este correo fue enviado a <span className="text-black">{email}</span>.
				Si no esperabas este mensaje, puedes ignorarlo.
			</Text>
		</Tailwind>
	);
}
