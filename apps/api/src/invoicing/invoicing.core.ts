/**
 * M31 invoicing — pure cores: GST tax split + document numbering. No DB.
 * Spec: PART II M31 + spec/08 (GST). Money = paise.
 */

export interface GstSplit {
  cgstPaise: number; // central — intra-state
  sgstPaise: number; // state — intra-state
  igstPaise: number; // integrated — inter-state
  totalTaxPaise: number;
}

/**
 * Split a tax amount into CGST+SGST (intra-state) or IGST (inter-state).
 * supplierState === placeOfSupply ⇒ intra-state (CGST+SGST each half);
 * else inter-state (full IGST). taxRateBp is the total GST rate in basis points.
 */
export function gstSplit(taxableValuePaise: number, taxRateBp: number, supplierState: string, placeOfSupply: string): GstSplit {
  const totalTax = Math.round((taxableValuePaise * taxRateBp) / 10000);
  if (supplierState === placeOfSupply) {
    const half = Math.round(totalTax / 2);
    return { cgstPaise: half, sgstPaise: totalTax - half, igstPaise: 0, totalTaxPaise: totalTax };
  }
  return { cgstPaise: 0, sgstPaise: 0, igstPaise: totalTax, totalTaxPaise: totalTax };
}

/** Render an invoice number from a per-seller series + sequential number. */
export function invoiceNo(series: string, seqNo: number): string {
  return `${series}/${String(seqNo).padStart(5, "0")}`;
}

export function creditNoteNo(series: string, seqNo: number): string {
  return `${series}-CN/${String(seqNo).padStart(5, "0")}`;
}

/** Per-seller GST series key for a financial year (India FY starts April). */
export function gstSeries(sellerCode: string, date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth(); // 0=Jan
  const fyStart = m >= 3 ? y : y - 1; // Apr–Mar
  const fy = `${String(fyStart).slice(2)}${String(fyStart + 1).slice(2)}`; // e.g. 2627
  return `${sellerCode}${fy}`;
}
