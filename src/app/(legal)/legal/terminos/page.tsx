import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import { legalPage } from "../_lib/legal-documents";

export const metadata: Metadata = {
  title: "Términos y condiciones | Cogni",
  description: legalPage("terminos").description,
};

export default function Page() {
  return <LegalPage slug="terminos" />;
}
