import { HomePageContent } from "@/components/home-page-content";
import { getCarouselLooks } from "@/lib/carousel-images";

export default async function Home() {
  const looks = await getCarouselLooks();
  return <HomePageContent looks={looks} />;
}
