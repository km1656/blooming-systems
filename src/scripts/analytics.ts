declare global {
  interface Window {
    dataLayer: unknown[][];
  }
}

const measurementId = import.meta.env.PUBLIC_GA_MEASUREMENT_ID;

if (measurementId) {
  const dataLayer = (window.dataLayer = window.dataLayer || []);
  const gtag = (...args: unknown[]) => dataLayer.push(args);

  gtag("js", new Date());
  gtag("config", measurementId);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.append(script);
}
