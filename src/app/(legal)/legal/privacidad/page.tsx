import type { Metadata } from "next";
import { LegalPage } from "../_components/legal-page";
import { legalPage } from "../_lib/legal-documents";

export const metadata: Metadata = {
  title: "Política de privacidad | Cogni",
  description: legalPage("privacidad").description,
};

export default function Page() {
  return <LegalPage slug="privacidad" />;
}
