import { MetadataRoute } from "next";

// Dashboard is private — block all crawlers
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
