// Inline SVG icon components — no third-party icon name references.
import type { SVGProps } from "react";
import { createElement } from "react";

// Attachment clip icon (matches lucide design spec, 24x24 viewBox)
export function AttachIcon(props: SVGProps<SVGSVGElement>) {
  return createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    ...props,
    children: createElement("path", {
      d: "m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48",
    }),
  });
}

// CrewSpace brand logo — dark navy background with 8 coral radiating bars and white terminal
export function CrewSpaceIcon(props: SVGProps<SVGSVGElement>) {
  return createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    ...props,
    children: [
      createElement("defs", { key: "defs" }, [
        createElement("radialGradient", { key: "bg", id: "cs-bg", cx: "50%", cy: "50%", r: "70%" }, [
          createElement("stop", { key: "s1", offset: "0%", stopColor: "#252538" }),
          createElement("stop", { key: "s2", offset: "100%", stopColor: "#141422" }),
        ]),
        createElement("linearGradient", { key: "bar", id: "cs-bar", x1: "0%", y1: "0%", x2: "100%", y2: "100%" }, [
          createElement("stop", { key: "s3", offset: "0%", stopColor: "#F2A07B" }),
          createElement("stop", { key: "s4", offset: "100%", stopColor: "#E07A5F" }),
        ]),
      ]),
      // Background
      createElement("rect", { key: "bg", width: 24, height: 24, rx: 5, fill: "url(#cs-bg)" }),
      // N bar
      createElement("rect", { key: "n", x: 10.5, y: 2, width: 3, height: 4.5, rx: 1, fill: "url(#cs-bar)" }),
      // S bar
      createElement("rect", { key: "s", x: 10.5, y: 17.5, width: 3, height: 4.5, rx: 1, fill: "url(#cs-bar)" }),
      // W bar
      createElement("rect", { key: "w", x: 2, y: 10.5, width: 4.5, height: 3, rx: 1, fill: "url(#cs-bar)" }),
      // E bar
      createElement("rect", { key: "e", x: 17.5, y: 10.5, width: 4.5, height: 3, rx: 1, fill: "url(#cs-bar)" }),
      // NE bar
      createElement("rect", { key: "ne", x: 15, y: 3.5, width: 2.5, height: 5.5, rx: 1, fill: "url(#cs-bar)", transform: "rotate(45 16.25 6.25)" }),
      // NW bar
      createElement("rect", { key: "nw", x: 6.5, y: 3.5, width: 2.5, height: 5.5, rx: 1, fill: "url(#cs-bar)", transform: "rotate(-45 7.75 6.25)" }),
      // SE bar
      createElement("rect", { key: "se", x: 15, y: 15, width: 2.5, height: 5.5, rx: 1, fill: "url(#cs-bar)", transform: "rotate(-45 16.25 17.75)" }),
      // SW bar
      createElement("rect", { key: "sw", x: 6.5, y: 15, width: 2.5, height: 5.5, rx: 1, fill: "url(#cs-bar)", transform: "rotate(45 7.75 17.75)" }),
      // Terminal frame
      createElement("rect", { key: "term", x: 7.5, y: 7.5, width: 9, height: 9, rx: 2, fill: "#FFFFFF" }),
      // Terminal screen
      createElement("rect", { key: "screen", x: 9, y: 9.5, width: 6, height: 5.5, rx: 1, fill: "#141422" }),
      // > prompt
      createElement("polygon", { key: "gt", points: "9.8,10.8 11.8,12 9.8,13.2 9.8,12.5 11,12 9.8,11.5", fill: "#FFFFFF" }),
      // _ cursor
      createElement("rect", { key: "cur", x: 12.2, y: 13, width: 1.8, height: 0.8, rx: 0.4, fill: "#FFFFFF" }),
    ],
  });
}
