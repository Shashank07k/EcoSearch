import { scoreRating } from '../utils/analysis.js';
import Icon from './Icon.jsx';

export default function AnalysisResult({ data, cached }) {
  const rating = scoreRating(data.score);
  return (
    <section className="analysis-result" aria-label="AI Sustainability Analysis">
      <div className="analysis-result__heading">
        <h4><Icon name="sparkles" size={17} /> AI Sustainability Analysis</h4>
        <span className="analysis-source" role="status"><Icon name="check" size={13} /> {cached ? 'Saved analysis' : 'New analysis'}</span>
      </div>
      <div className="analysis-score-row">
        <div><span className="analysis-score-label">Sustainability score</span><div className="analysis-score">{data.score}<span>/100</span></div></div>
        <div className={`analysis-rating analysis-rating--${rating.band}`}><span>Rating</span><strong>{rating.label}</strong></div>
      </div>
      <h5>Summary</h5>
      <p className="analysis-summary">{data.summary}</p>
      <h5>Environmental factors</h5>
      {data.factors.length ? <ul className="analysis-factors">{data.factors.map((factor, i) => (
        <li key={`${factor.name}-${i}`}>
          <div><strong>{factor.name}</strong><span className={`impact impact--${factor.impact}`}>{factor.impact}</span></div>
          <p>{factor.description}</p>
        </li>
      ))}</ul> : <p className="analysis-empty">Not enough information to identify specific factors.</p>}
      <h5>Eco-friendly alternatives</h5>
      {data.alternatives.length ? <ul className="analysis-alternatives">{data.alternatives.map((alternative, i) => (
        <li key={`${alternative.name}-${i}`}><Icon name="leaf" size={17} /><div><strong>{alternative.name}</strong><p>{alternative.reason}</p></div></li>
      ))}</ul> : <p className="analysis-empty">No alternatives suggested from the available information.</p>}
      <p className="analysis-disclaimer"><Icon name="info" size={15} /><span>An AI estimate based on this listing, not a certified environmental assessment. Ratings are EcoSearch’s own interpretation. Verify important claims independently.</span></p>
    </section>
  );
}
