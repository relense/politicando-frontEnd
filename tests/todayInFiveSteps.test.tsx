import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TodayInFive } from "@/components/TodayInFive";
import type { Story } from "@/lib/api/stories";

const story = (id: number): Story =>
  ({
    id,
    title: `História ${id}`,
    excerpt: null,
    imageUrl: null,
    firstPublishedAt: "2026-11-20T08:00:00.000Z",
    lastPublishedAt: "2026-11-20T09:00:00.000Z",
    sourceCount: 2,
    recentSourceCount: 2,
    versions: [],
    parties: [],
    deputies: [],
    government: [],
    president: null,
    people: [],
    initiatives: [],
    importa: 0,
    importance: 0,
    commentCount: 0,
    tags: [],
    debate: null,
    mergedFrom: [],
  }) as unknown as Story;

const five = [1, 2, 3, 4, 5].map(story);
const shown = () => screen.getAllByRole("link").map((link) => link.textContent);

describe("«Hoje em 5», one story at a time", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows only the first story not read yet, with the progress", () => {
    window.localStorage.setItem("stories-read", JSON.stringify([1, 2]));
    render(<TodayInFive stories={five} />);
    expect(shown()).toEqual(["História 3"]);
    expect(screen.getByText("2 de 5")).toBeInTheDocument();
  });

  it("goes back and forth, and says where the reader is and what's read", () => {
    window.localStorage.setItem("stories-read", JSON.stringify([1]));
    render(<TodayInFive stories={five} />);
    fireEvent.click(screen.getByRole("button", { name: "História anterior" }));
    expect(shown()).toEqual(["História 1"]);
    expect(screen.getByRole("button", { name: "História anterior" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "História seguinte" }));
    fireEvent.click(screen.getByRole("button", { name: "História seguinte" }));
    expect(shown()).toEqual(["História 3"]);
    expect(screen.getByRole("button", { name: "Ir para a história 1 (lida)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para a história 3 (por ler)" })).toHaveAttribute("aria-current", "step");
    fireEvent.click(screen.getByRole("button", { name: "Ir para a história 5 (por ler)" }));
    expect(shown()).toEqual(["História 5"]);
    expect(screen.getByRole("button", { name: "História seguinte" })).toBeDisabled();
  });

  it("with all read, says so and starts again from the first", () => {
    window.localStorage.setItem("stories-read", JSON.stringify([1, 2, 3, 4, 5]));
    render(<TodayInFive stories={five} />);
    expect(screen.getByText("Estás em dia ✓")).toBeInTheDocument();
    expect(shown()).toEqual(["História 1"]);
  });
});
