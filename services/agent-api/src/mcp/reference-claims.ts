/**
 * Interpret only EXACT, explicitly documented source labels.
 * A source's classification is not an independent transcription,
 * music-theory proof or expert-reviewed listening judgment.
 */
const GROOVE_SOURCE_LABELS={
 'blues/shuffle':'shuffle'
} as const;

export type DeclaredGroove={
 value:string;
 status:'source_declared';
 sourceField:'style';
 originalLabel:string;
 sourceEvidenceUrl:string;
 independentlyReviewed:false;
};
export function getSourceGrooveClaim(sourceStyle:string|null,sourceUrl:string):DeclaredGroove|null{
 if(sourceStyle===null||!Object.hasOwn(GROOVE_SOURCE_LABELS,sourceStyle))return null;
 if(!sourceUrl.startsWith('https://magenta.withgoogle.com/datasets/groove'))return null;
 return {
  value:GROOVE_SOURCE_LABELS[sourceStyle as keyof typeof GROOVE_SOURCE_LABELS],
  status:'source_declared',sourceField:'style',originalLabel:sourceStyle,
  sourceEvidenceUrl:sourceUrl,independentlyReviewed:false
 };
}
