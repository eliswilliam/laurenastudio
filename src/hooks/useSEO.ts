import { useEffect } from "react";

interface SEOMeta {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  noIndex?: boolean;
  canonical?: string;
}

const SITE_NAME = "Laurena Studio";
const BASE_URL = "https://laurenastudio.pro";
const DEFAULT_TITLE = `${SITE_NAME} — Plataforma de IA para criadores de conteúdo`;
const DEFAULT_DESC = "Crie posts, imagens, vídeos e áudio com Inteligência Artificial, agende em todas as redes sociais e acompanhe seus resultados. Tudo em um só lugar.";
const DEFAULT_IMAGE = `${BASE_URL}/android-chrome-512x512.png`;

function setMeta(selector: string, content: string) {
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    const [attr, val] = selector.replace("meta[", "").replace("]", "").split('="');
    el.setAttribute(attr, val.replace('"', ""));
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setOrCreateMeta(attrName: string, attrValue: string, content: string) {
  let el = document.querySelector(`meta[${attrName}="${attrValue}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function useSEO({
  title,
  description,
  image,
  url,
  type = "website",
  noIndex = false,
  canonical,
}: SEOMeta = {}) {
  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const desc = description ?? DEFAULT_DESC;
    const img = image ? (image.startsWith("http") ? image : `${BASE_URL}${image}`) : DEFAULT_IMAGE;
    const pageUrl = url
      ? url.startsWith("http") ? url : `${BASE_URL}${url}`
      : `${BASE_URL}${window.location.pathname}`;

    document.title = fullTitle;

    setOrCreateMeta("name", "description", desc);
    setOrCreateMeta("name", "robots", noIndex ? "noindex,nofollow" : "index,follow");

    setCanonical(canonical ?? pageUrl);

    setOrCreateMeta("property", "og:title", fullTitle);
    setOrCreateMeta("property", "og:description", desc);
    setOrCreateMeta("property", "og:url", pageUrl);
    setOrCreateMeta("property", "og:image", img);
    setOrCreateMeta("property", "og:type", type);

    setOrCreateMeta("name", "twitter:title", fullTitle);
    setOrCreateMeta("name", "twitter:description", desc);
    setOrCreateMeta("name", "twitter:image", img);

    return () => {
      document.title = DEFAULT_TITLE;
      setOrCreateMeta("name", "robots", "index,follow");
    };
  }, [title, description, image, url, type, noIndex, canonical]);
}
