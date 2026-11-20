import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import { ImportaButton } from "@/components/ImportaButton";
import { TodayInFive } from "@/components/TodayInFive";
import { knowsStory, storyIds, type Story } from "@/lib/api/stories";

const story = (id: number, mergedFrom: number[]): Story => ({
  id,
  title: `História ${id}`,
  excerpt: null,
  imageUrl: null,
  firstPublishedAt: "2026-11-20T08:00:00.000Z",
  lastPublishedAt: "2026-11-20T09:00:00.000Z",
  sourceCount: 2,
  recentSourceCount: 2,
  versions: [
    {
      source: "Jornal Exemplo",
      sourceDomain: "exemplo.pt",
      articleId: id * 10,
      title: `História ${id}`,
      url: null,
      publishedAt: "2026-11-20T08:00:00.000Z",
    },
  ],
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
  mergedFrom,
});

const withQueries = (node: ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>);

describe("a story joined from older ones (mergedFrom)", () => {
  it("answers to its own id and every old one", () => {
    expect(storyIds(story(659, [688, 701]))).toEqual([659, 688, 701]);
    expect(knowsStory([688], story(659, [688]))).toBe(true);
    expect(knowsStory(new Set([1]), story(659, [688]))).toBe(false);
  });

  describe("«Hoje em 5»", () => {
    beforeEach(() => window.localStorage.clear());
    it("counts a story opened under its old id as read", () => {
      window.localStorage.setItem("stories-read", JSON.stringify([688]));
      render(<TodayInFive stories={[story(659, [688]), story(660, [])]} />);
      expect(screen.getByText("1 de 2")).toBeInTheDocument();
    });
  });

  describe("Importa", () => {
    beforeEach(() => window.localStorage.clear());
    it("shows the reader's mark made on an old id as theirs", () => {
      window.localStorage.setItem("story-importa", JSON.stringify({ 688: 1 }));
      withQueries(<ImportaButton id={659} title="História 659" importa={3} importance={0.5} mergedFrom={[688]} />);
      expect(screen.getByRole("button", { pressed: true })).toBeInTheDocument();
    });
    it("not when the mark is on another story", () => {
      window.localStorage.setItem("story-importa", JSON.stringify({ 1: 1 }));
      withQueries(<ImportaButton id={659} title="História 659" importa={3} importance={0.5} mergedFrom={[688]} />);
      expect(screen.getByRole("button", { pressed: false })).toBeInTheDocument();
    });
  });
});
