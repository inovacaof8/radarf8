import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Exporta um elemento DOM para PDF multi-página A4 paisagem.
 * Faz fatiamento por altura para não cortar conteúdo entre páginas.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string,
  opts: { orientation?: "p" | "l"; title?: string } = {}
) {
  const orientation = opts.orientation || "l";

  // Render with higher scale for sharpness
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const usableHeight = pageHeight - margin * 2;

  // Convert canvas pixel height into mm at the print width
  const pxPerMm = canvas.width / usableWidth;
  const sliceHeightPx = Math.floor(usableHeight * pxPerMm);

  let renderedPx = 0;
  let pageIdx = 0;

  while (renderedPx < canvas.height) {
    const remaining = canvas.height - renderedPx;
    const slicePx = Math.min(sliceHeightPx, remaining);

    const sliceCanvas = document.createElement("canvas");
    sliceCanvas.width = canvas.width;
    sliceCanvas.height = slicePx;
    const ctx = sliceCanvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
    ctx.drawImage(
      canvas,
      0, renderedPx, canvas.width, slicePx,
      0, 0, canvas.width, slicePx
    );

    const imgData = sliceCanvas.toDataURL("image/jpeg", 0.95);
    if (pageIdx > 0) pdf.addPage();
    const sliceMmHeight = slicePx / pxPerMm;
    pdf.addImage(imgData, "JPEG", margin, margin, usableWidth, sliceMmHeight);

    if (opts.title) {
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(
        `${opts.title} · pág. ${pageIdx + 1}`,
        margin,
        pageHeight - 3
      );
    }

    renderedPx += slicePx;
    pageIdx += 1;
  }

  pdf.save(fileName);
}
