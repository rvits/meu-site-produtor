import type { Metadata } from "next";
import { getPublishedPortfolio } from "./portfolio-store";
import { PortfolioExperience } from "./components/PortfolioEditor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfólio | THouse Rec",
  description: "Portfólio de Victor Pereira Ramos, produtor musical e produtor fonográfico.",
};

export default async function PortfolioPage() {
  const published = await getPublishedPortfolio();
  return <PortfolioExperience initialPublished={published} />;
}
