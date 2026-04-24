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

// CrewSpace brand logo — purple and cyan grid mark representing network collaboration
export function CrewSpaceIcon(props: SVGProps<SVGSVGElement>) {
  return createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    ...props,
    children: [
      // Purple grid (left side)
      createElement("rect", { key: "p1", x: "2.75", y: "4.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      createElement("rect", { key: "p2", x: "5.75", y: "4.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      createElement("rect", { key: "p3", x: "8.75", y: "4.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      createElement("rect", { key: "p4", x: "2.75", y: "7.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      createElement("rect", { key: "p5", x: "2.75", y: "10.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      createElement("rect", { key: "p6", x: "2.75", y: "13.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      createElement("rect", { key: "p7", x: "2.75", y: "16.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      createElement("rect", { key: "p8", x: "5.75", y: "16.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      createElement("rect", { key: "p9", x: "8.75", y: "16.75", width: "2.5", height: "2.5", rx: ".6", fill: "#7b5ff5" }),
      // Cyan grid (right side)
      createElement("rect", { key: "c1", x: "12.75", y: "4.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c2", x: "15.75", y: "4.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c3", x: "18.75", y: "4.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c4", x: "12.75", y: "7.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c5", x: "12.75", y: "10.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c6", x: "15.75", y: "10.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c7", x: "18.75", y: "10.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c8", x: "18.75", y: "13.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c9", x: "12.75", y: "16.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c10", x: "15.75", y: "16.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
      createElement("rect", { key: "c11", x: "18.75", y: "16.75", width: "2.5", height: "2.5", rx: ".6", fill: "#2ecfc1" }),
    ],
  });
}
