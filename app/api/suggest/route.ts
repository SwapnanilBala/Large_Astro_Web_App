import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q") ?? "";
  const type = searchParams.get("type") ?? "city";

  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const featureMap: Record<string, string> = {
    country: "country",
    state: "state",
    city: "city",
  };

  try {
    const nominatimUrl = new URL("https://nominatim.openstreetmap.org/search");
    nominatimUrl.searchParams.set("q", query);
    nominatimUrl.searchParams.set("format", "json");
    nominatimUrl.searchParams.set("limit", "5");
    nominatimUrl.searchParams.set("addressdetails", "1");

    if (featureMap[type]) {
      nominatimUrl.searchParams.set("featuretype", featureMap[type]);
    }

    const response = await fetch(nominatimUrl.toString(), {
      headers: {
        "User-Agent": "AstroIntelligenceStudio/1.0 (educational-astrology-app)",
      },
    });

    if (!response.ok) {
      return NextResponse.json([]);
    }

    const data = await response.json();

    const suggestions = data.map(
      (item: { display_name?: string; name?: string; address?: Record<string, string> }) => {
        let name = item.name ?? "";

        if (type === "country" && item.address?.country) {
          name = item.address.country;
        } else if (type === "state" && item.address?.state) {
          name = item.address.state;
        } else if (type === "city") {
          name = item.address?.city ?? item.address?.town ?? item.name ?? "";
        }

        return {
          name,
          displayName: item.display_name ?? name,
        };
      }
    );

    const uniqueNames = new Set<string>();
    const unique = suggestions.filter((s: { name: string }) => {
      if (!s.name || uniqueNames.has(s.name)) return false;
      uniqueNames.add(s.name);
      return true;
    });

    return NextResponse.json(unique);
  } catch {
    return NextResponse.json([]);
  }
}
