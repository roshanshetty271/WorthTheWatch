import type { Metadata } from "next";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
    title: "Contact Us",
    description: "Get in touch with the Worth the Watch? team.",
    alternates: { canonical: "https://worth-the-watch.com/contact" },
};

export default function ContactPage() {
    return (
        <div className="min-h-screen pt-28 md:pt-32 pb-16 px-4">
            <div className="mx-auto max-w-lg">
                <h1 className="font-display text-3xl md:text-4xl text-white mb-2">
                    Get in touch
                </h1>
                <p className="text-sm text-white/50 mb-8">
                    Bug report, feedback, data deletion request, or just want to say hi? We&apos;d love to hear from you.
                </p>
                <ContactForm />
            </div>
        </div>
    );
}
