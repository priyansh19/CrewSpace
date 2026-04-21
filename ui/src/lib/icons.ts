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

// CrewSpace brand logo — three nodes connected in a triangle representing crew collaboration
export function CrewSpaceIcon(props: SVGProps<SVGSVGElement>) {
  return createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    ...props,
    children: [
      // Connecting lines (triangle)
      createElement("line", { key: "l1", x1: "12", y1: "3.5", x2: "20.5", y2: "18", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
      createElement("line", { key: "l2", x1: "12", y1: "3.5", x2: "3.5", y2: "18", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
      createElement("line", { key: "l3", x1: "3.5", y1: "18", x2: "20.5", y2: "18", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
      // Nodes
      createElement("circle", { key: "c1", cx: "12", cy: "3.5", r: "2.5", fill: "currentColor" }),
      createElement("circle", { key: "c2", cx: "20.5", cy: "18", r: "2.5", fill: "currentColor" }),
      createElement("circle", { key: "c3", cx: "3.5", cy: "18", r: "2.5", fill: "currentColor" }),
    ],
  });
}
