import type { Metadata } from "next";
import { MyPredictionsList } from "@/components/Predictions";

export const metadata: Metadata = {
  title: "As minhas previsões",
  robots: { index: false, follow: false },
};

export default function MyPredictionsPage() {
  return <MyPredictionsList />;
}
