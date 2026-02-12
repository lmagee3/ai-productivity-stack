import { get } from "./api/client";

export type Headline = {
  title: string;
  source: string;
  url: string;
  published_at: string | null;
};

export type HeadlineResponse = {
  updated_at: string;
  headlines: Headline[];
  stale: boolean;
};

export async function fetchHeadlines(): Promise<HeadlineResponse> {
  return get<HeadlineResponse>("/news/headlines");
}

