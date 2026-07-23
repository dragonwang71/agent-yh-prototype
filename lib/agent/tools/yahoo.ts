import { z } from "zod";
import type {
  EvidenceRef,
  ToolCall,
  ToolErrorCode,
  ToolResult
} from "@/lib/agent/schemas";

const shoppingItemSchema = z.object({
  name: z.string().optional(),
  price: z.number().optional(),
  url: z.string().optional(),
  review: z
    .object({
      rate: z.number().optional(),
      count: z.number().optional()
    })
    .optional(),
  seller: z.object({ name: z.string().optional() }).optional(),
  image: z.object({ medium: z.string().optional() }).optional(),
  exImage: z.object({ url: z.string().optional() }).optional()
});

const shoppingResponseSchema = z.object({
  hits: z.array(shoppingItemSchema).optional()
});

const yahooFeatureSchema = z.object({
  Name: z.string().optional(),
  Geometry: z.object({ Coordinates: z.string().optional() }).optional()
});

const yahooFeatureResponseSchema = z.object({
  Feature: z.array(yahooFeatureSchema).optional()
});

const yahooWeatherPointSchema = z.object({
  Rainfall: z.number().optional(),
  Date: z.string().optional()
});

const yahooWeatherResponseSchema = z.object({
  Feature: z
    .array(
      z.object({
        Property: z
          .object({
            WeatherList: z
              .object({
                Weather: z.array(yahooWeatherPointSchema).optional()
              })
              .optional()
          })
          .optional()
      })
    )
    .optional()
});

const yahooLocalGenreSchema = z.object({ Name: z.string().optional() });
const yahooLocalStationSchema = z.object({
  Name: z.string().optional(),
  Distance: z.union([z.string(), z.number()]).optional(),
  Time: z.union([z.string(), z.number()]).optional()
});
const yahooLocalFeatureSchema = yahooFeatureSchema.extend({
  Property: z
    .object({
      Address: z.string().optional(),
      Genre: z.union([yahooLocalGenreSchema, z.array(yahooLocalGenreSchema)]).optional(),
      LeadImage: z.string().optional(),
      Station: z.union([yahooLocalStationSchema, z.array(yahooLocalStationSchema)]).optional(),
      PcUrl1: z.string().optional(),
      ReviewUrl: z.string().optional(),
      Detail: z.object({ PcUrl1: z.string().optional() }).optional()
    })
    .optional()
});
const yahooLocalResponseSchema = z.object({
  Feature: z.union([yahooLocalFeatureSchema, z.array(yahooLocalFeatureSchema)]).optional()
});

export type ShoppingCandidate = {
  id: string;
  title: string;
  priceYen?: number;
  url?: string;
  rating?: number;
  reviewCount?: number;
  seller?: string;
  imageUrl?: string;
  query: string;
  evidence: EvidenceRef[];
  fieldEvidence: {
    title: string[];
    price: string[];
    score: string[];
    meta: string[];
    imageUrl: string[];
    actionUrl: string[];
  };
};

export type GeocodeLocation = {
  name: string;
  coordinates: string;
  lon: string;
  lat: string;
  evidence: EvidenceRef[];
};

export type WeatherSnapshot = {
  points: Array<{ rainfall: number; date?: string }>;
  maxRainfall: number;
  evidence: EvidenceRef[];
};

export type LocalPlace = {
  id: string;
  name: string;
  address?: string;
  genres: string[];
  imageUrl?: string;
  station?: {
    name?: string;
    distanceMeters?: number;
    walkingMinutes?: number;
  };
  url?: string;
  coordinates?: string;
  evidence: EvidenceRef[];
  fieldEvidence: {
    title: string[];
    meta: string[];
    imageUrl: string[];
    score: string[];
    actionUrl: string[];
  };
};

const yahooTimeoutMs = 8_000;
const maxRetries = 1;

export async function searchShopping({
  clientId,
  priceMax,
  query,
  signal,
  toolCallId
}: {
  clientId: string;
  priceMax?: number | null;
  query: string;
  signal: AbortSignal;
  toolCallId: string;
}): Promise<ToolResult<ShoppingCandidate[]>> {
  const params = new URLSearchParams({
    appid: clientId,
    image_size: "300",
    query,
    results: "20"
  });

  if (priceMax) {
    params.set("price_to", String(priceMax));
  }

  const result = await fetchYahooJson(
    `https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch?${params.toString()}`,
    shoppingResponseSchema,
    toolCallId,
    signal
  );

  if (!result.ok) {
    return result;
  }

  const candidates = (result.data.hits ?? [])
    .map((item, index) => normalizeShoppingCandidate(item, index, query, toolCallId, result.meta.fetchedAt))
    .filter((item): item is ShoppingCandidate => Boolean(item));

  if (!candidates.length) {
    return failureResult(toolCallId, result.meta.latencyMs, result.meta.retryCount, "NO_RESULTS");
  }

  return {
    ok: true,
    data: candidates,
    evidence: candidates.flatMap((item) => item.evidence),
    meta: result.meta
  };
}

export async function geocodePlace({
  clientId,
  place,
  signal,
  toolCallId
}: {
  clientId: string;
  place: string;
  signal: AbortSignal;
  toolCallId: string;
}): Promise<ToolResult<GeocodeLocation>> {
  const params = new URLSearchParams({
    appid: clientId,
    query: place,
    output: "json",
    results: "1"
  });
  const result = await fetchYahooJson(
    `https://map.yahooapis.jp/geocode/V1/geoCoder?${params.toString()}`,
    yahooFeatureResponseSchema,
    toolCallId,
    signal
  );

  if (!result.ok) {
    return result;
  }

  const feature = result.data.Feature?.[0];
  const coordinates = feature?.Geometry?.Coordinates;
  const [lon, lat] = coordinates?.split(",").map((value) => value.trim()) ?? [];

  if (!coordinates || !lon || !lat) {
    return failureResult(toolCallId, result.meta.latencyMs, result.meta.retryCount, "NO_RESULTS");
  }

  const evidence = [
    evidenceRef(toolCallId, "yahoo_geocoder", "Feature[0].Name", result.meta.fetchedAt),
    evidenceRef(
      toolCallId,
      "yahoo_geocoder",
      "Feature[0].Geometry.Coordinates",
      result.meta.fetchedAt
    )
  ];

  return {
    ok: true,
    data: {
      name: feature?.Name ?? place,
      coordinates,
      lon,
      lat,
      evidence
    },
    evidence,
    meta: result.meta
  };
}

export async function getWeather({
  clientId,
  coordinates,
  signal,
  toolCallId
}: {
  clientId: string;
  coordinates: string;
  signal: AbortSignal;
  toolCallId: string;
}): Promise<ToolResult<WeatherSnapshot>> {
  const params = new URLSearchParams({
    appid: clientId,
    coordinates,
    output: "json"
  });
  const result = await fetchYahooJson(
    `https://map.yahooapis.jp/weather/V1/place?${params.toString()}`,
    yahooWeatherResponseSchema,
    toolCallId,
    signal
  );

  if (!result.ok) {
    return result;
  }

  const points = (result.data.Feature?.[0]?.Property?.WeatherList?.Weather ?? []).map((point) => ({
    rainfall: point.Rainfall ?? 0,
    date: point.Date
  }));

  if (!points.length) {
    return failureResult(toolCallId, result.meta.latencyMs, result.meta.retryCount, "NO_RESULTS");
  }

  const evidence = points.flatMap((_, index) => [
    evidenceRef(
      toolCallId,
      "yahoo_weather",
      `Feature[0].Property.WeatherList.Weather[${index}].Rainfall`,
      result.meta.fetchedAt
    ),
    evidenceRef(
      toolCallId,
      "yahoo_weather",
      `Feature[0].Property.WeatherList.Weather[${index}].Date`,
      result.meta.fetchedAt
    )
  ]);

  return {
    ok: true,
    data: {
      points,
      maxRainfall: Math.max(...points.map((point) => point.rainfall)),
      evidence
    },
    evidence,
    meta: result.meta
  };
}

export async function searchLocalPlaces({
  clientId,
  lat,
  lon,
  query,
  signal,
  toolCallId
}: {
  clientId: string;
  lat: string;
  lon: string;
  query: string;
  signal: AbortSignal;
  toolCallId: string;
}): Promise<ToolResult<LocalPlace[]>> {
  const params = new URLSearchParams({
    appid: clientId,
    query,
    lat,
    lon,
    dist: "2",
    image: "true",
    sort: "geo",
    results: "12",
    detail: "standard",
    output: "json"
  });
  const result = await fetchYahooJson(
    `https://map.yahooapis.jp/search/local/V1/localSearch?${params.toString()}`,
    yahooLocalResponseSchema,
    toolCallId,
    signal
  );

  if (!result.ok) {
    return result;
  }

  const rawFeatures = result.data.Feature
    ? Array.isArray(result.data.Feature)
      ? result.data.Feature
      : [result.data.Feature]
    : [];
  const places = dedupeLocalPlaces(
    rawFeatures.map((feature, index) =>
      normalizeLocalPlace(feature, index, toolCallId, result.meta.fetchedAt)
    )
  );

  if (!places.length) {
    return failureResult(toolCallId, result.meta.latencyMs, result.meta.retryCount, "NO_RESULTS");
  }

  return {
    ok: true,
    data: places,
    evidence: places.flatMap((place) => place.evidence),
    meta: result.meta
  };
}

export function toolCallFromResult<T>({
  input,
  result,
  tool
}: {
  input: string;
  result: ToolResult<T>;
  tool: string;
}): ToolCall {
  return {
    id: result.meta.toolCallId,
    tool,
    input,
    status: result.ok ? "success" : "error",
    latencyMs: result.meta.latencyMs,
    retryCount: result.meta.retryCount,
    cacheStatus: result.ok ? result.meta.cacheStatus : "disabled",
    evidenceCount: result.ok ? result.evidence.length : 0,
    ...(!result.ok ? { errorCode: result.error.code } : {})
  };
}

async function fetchYahooJson<T>(
  url: string,
  schema: z.ZodType<T>,
  toolCallId: string,
  signal: AbortSignal
): Promise<ToolResult<T>> {
  const started = performance.now();
  let retryCount = 0;

  while (retryCount <= maxRetries) {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(yahooTimeoutMs)]);

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: requestSignal
      });

      if (!response.ok) {
        const code = classifyHttpStatus(response.status);
        const retryable = code === "RATE_LIMITED" || code === "UPSTREAM_5XX";

        if (retryable && retryCount < maxRetries && !signal.aborted) {
          retryCount += 1;
          await retryDelay(retryCount, signal);
          continue;
        }

        return failureResult(
          toolCallId,
          Math.round(performance.now() - started),
          retryCount,
          code
        );
      }

      const raw: unknown = await response.json();
      const parsed = schema.safeParse(raw);

      if (!parsed.success) {
        return failureResult(
          toolCallId,
          Math.round(performance.now() - started),
          retryCount,
          "INVALID_SCHEMA"
        );
      }

      return {
        ok: true,
        data: parsed.data,
        evidence: [],
        meta: {
          toolCallId,
          fetchedAt: new Date().toISOString(),
          latencyMs: Math.round(performance.now() - started),
          retryCount,
          cacheStatus: "disabled"
        }
      };
    } catch (error) {
      const aborted = signal.aborted;
      const timedOut = error instanceof DOMException && error.name === "TimeoutError";
      const code: ToolErrorCode = aborted ? "ABORTED" : timedOut ? "TIMEOUT" : "UNKNOWN";

      if (!aborted && !timedOut && retryCount < maxRetries) {
        retryCount += 1;
        await retryDelay(retryCount, signal);
        continue;
      }

      return failureResult(
        toolCallId,
        Math.round(performance.now() - started),
        retryCount,
        code
      );
    }
  }

  return failureResult(
    toolCallId,
    Math.round(performance.now() - started),
    retryCount,
    "UNKNOWN"
  );
}

function normalizeShoppingCandidate(
  item: z.infer<typeof shoppingItemSchema>,
  index: number,
  query: string,
  toolCallId: string,
  fetchedAt: string
): ShoppingCandidate | null {
  const title = sanitizeText(item.name, 240);

  if (!title) {
    return null;
  }

  const prefix = `hits[${index}]`;
  const refs = {
    title: [evidenceRef(toolCallId, "yahoo_shopping", `${prefix}.name`, fetchedAt)],
    price:
      typeof item.price === "number"
        ? [evidenceRef(toolCallId, "yahoo_shopping", `${prefix}.price`, fetchedAt)]
        : [],
    score:
      typeof item.review?.rate === "number"
        ? [
            evidenceRef(toolCallId, "yahoo_shopping", `${prefix}.review.rate`, fetchedAt),
            ...(typeof item.review?.count === "number"
              ? [evidenceRef(toolCallId, "yahoo_shopping", `${prefix}.review.count`, fetchedAt)]
              : [])
          ]
        : [],
    meta: item.seller?.name
      ? [evidenceRef(toolCallId, "yahoo_shopping", `${prefix}.seller.name`, fetchedAt)]
      : [],
    imageUrl:
      item.exImage?.url || item.image?.medium
        ? [
            evidenceRef(
              toolCallId,
              "yahoo_shopping",
              item.exImage?.url ? `${prefix}.exImage.url` : `${prefix}.image.medium`,
              fetchedAt
            )
          ]
        : [],
    actionUrl: item.url
      ? [evidenceRef(toolCallId, "yahoo_shopping", `${prefix}.url`, fetchedAt, item.url)]
      : []
  };

  return {
    id: `${toolCallId}-${index + 1}`,
    title,
    priceYen: item.price,
    url: safeHttpsUrl(item.url),
    rating: item.review?.rate,
    reviewCount: item.review?.count,
    seller: sanitizeText(item.seller?.name, 120),
    imageUrl: safeHttpsUrl(item.exImage?.url ?? item.image?.medium),
    query,
    evidence: Object.values(refs).flat(),
    fieldEvidence: Object.fromEntries(
      Object.entries(refs).map(([key, values]) => [key, values.map((ref) => ref.id)])
    ) as ShoppingCandidate["fieldEvidence"]
  };
}

function normalizeLocalPlace(
  feature: z.infer<typeof yahooLocalFeatureSchema>,
  index: number,
  toolCallId: string,
  fetchedAt: string
): LocalPlace {
  const prefix = Array.isArray(feature) ? `Feature[${index}]` : `Feature[${index}]`;
  const property = feature.Property;
  const genres = property?.Genre
    ? (Array.isArray(property.Genre) ? property.Genre : [property.Genre])
        .map((genre) => sanitizeText(genre.Name, 80))
        .filter((name): name is string => Boolean(name))
    : [];
  const stationRaw = property?.Station
    ? Array.isArray(property.Station)
      ? property.Station[0]
      : property.Station
    : undefined;
  const url = property?.PcUrl1 ?? property?.Detail?.PcUrl1 ?? property?.ReviewUrl;
  const station = stationRaw
    ? {
        name: sanitizeText(stationRaw.Name, 120),
        distanceMeters: toNumber(stationRaw.Distance),
        walkingMinutes: toNumber(stationRaw.Time)
      }
    : undefined;
  const titleEvidence = [evidenceRef(toolCallId, "yahoo_local_search", `${prefix}.Name`, fetchedAt)];
  const metaEvidence = [
    ...(property?.Address
      ? [
          evidenceRef(
            toolCallId,
            "yahoo_local_search",
            `${prefix}.Property.Address`,
            fetchedAt
          )
        ]
      : []),
    ...(genres.length
      ? [
          evidenceRef(
            toolCallId,
            "yahoo_local_search",
            `${prefix}.Property.Genre`,
            fetchedAt
          )
        ]
      : [])
  ];
  const scoreEvidence = station
    ? [
        evidenceRef(
          toolCallId,
          "yahoo_local_search",
          `${prefix}.Property.Station`,
          fetchedAt
        )
      ]
    : [];
  const imageEvidence = property?.LeadImage
    ? [
        evidenceRef(
          toolCallId,
          "yahoo_local_search",
          `${prefix}.Property.LeadImage`,
          fetchedAt
        )
      ]
    : [];
  const actionEvidence = url
    ? [
        evidenceRef(
          toolCallId,
          "yahoo_local_search",
          `${prefix}.Property.PcUrl1`,
          fetchedAt,
          url
        )
      ]
    : [];
  const evidence = [
    ...titleEvidence,
    ...metaEvidence,
    ...scoreEvidence,
    ...imageEvidence,
    ...actionEvidence
  ];

  return {
    id: `${toolCallId}-${index + 1}`,
    name: sanitizeText(feature.Name, 240) || "Unknown place",
    address: sanitizeText(property?.Address, 240),
    genres,
    imageUrl: safeHttpsUrl(property?.LeadImage),
    station,
    url: safeHttpsUrl(url),
    coordinates: feature.Geometry?.Coordinates,
    evidence,
    fieldEvidence: {
      title: titleEvidence.map((ref) => ref.id),
      meta: metaEvidence.map((ref) => ref.id),
      imageUrl: imageEvidence.map((ref) => ref.id),
      score: scoreEvidence.map((ref) => ref.id),
      actionUrl: actionEvidence.map((ref) => ref.id)
    }
  };
}

function dedupeLocalPlaces(places: LocalPlace[]) {
  const seen = new Set<string>();

  return places.filter((place) => {
    const key = `${place.name}|${place.coordinates ?? place.address ?? ""}`
      .replace(/[\s　]/g, "")
      .toLowerCase();

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sanitizeText(value: string | undefined, maxLength: number) {
  const normalized = value
    ?.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  return normalized || undefined;
}

function evidenceRef(
  toolCallId: string,
  sourceType: EvidenceRef["sourceType"],
  fieldPath: string,
  fetchedAt: string,
  sourceUrl?: string
): EvidenceRef {
  return {
    id: `${toolCallId}:${fieldPath}`,
    sourceType,
    toolCallId,
    fieldPath,
    fetchedAt,
    ...(safeHttpsUrl(sourceUrl) ? { sourceUrl: safeHttpsUrl(sourceUrl) } : {})
  };
}

function failureResult(
  toolCallId: string,
  latencyMs: number,
  retryCount: number,
  code: ToolErrorCode
): ToolResult<never> {
  return {
    ok: false,
    error: {
      code,
      retryable: code === "RATE_LIMITED" || code === "UPSTREAM_5XX" || code === "UNKNOWN",
      safeMessage: safeErrorMessage(code)
    },
    meta: {
      toolCallId,
      latencyMs,
      retryCount
    }
  };
}

function classifyHttpStatus(status: number): ToolErrorCode {
  if (status === 401 || status === 403) {
    return "AUTH_ERROR";
  }

  if (status === 429) {
    return "RATE_LIMITED";
  }

  if (status >= 500) {
    return "UPSTREAM_5XX";
  }

  return "UPSTREAM_4XX";
}

function safeErrorMessage(code: ToolErrorCode) {
  const messages: Record<ToolErrorCode, string> = {
    AUTH_ERROR: "The external data service could not authenticate this request.",
    RATE_LIMITED: "The external data service is temporarily rate limited.",
    TIMEOUT: "The external data service did not respond before the deadline.",
    UPSTREAM_4XX: "The external data service rejected this request.",
    UPSTREAM_5XX: "The external data service is temporarily unavailable.",
    INVALID_SCHEMA: "The external data service returned an unexpected response shape.",
    NO_RESULTS: "The external data service returned no matching results.",
    ABORTED: "The request was canceled.",
    UNKNOWN: "The external data service request failed."
  };

  return messages[code];
}

function safeHttpsUrl(value?: string) {
  if (!value) {
    return undefined;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function toNumber(value?: string | number) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function retryDelay(retryCount: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const delayMs = 120 * 2 ** (retryCount - 1) + Math.round(Math.random() * 80);
    const timer = setTimeout(resolve, delayMs);

    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
