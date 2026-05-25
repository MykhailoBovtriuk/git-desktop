import { useMemo } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { computeLayout } from './graph-layout';
import { relativeTime } from '../../lib/relative-time';

const ROW_H = 28;
const LANE_W = 20;
const GRAPH_PAD = 10;

export function CommitGraph() {
  const { commits } = useRepoStore();
  const { selectedCommit, setSelectedCommit } = useUiStore();
  const layout = useMemo(() => computeLayout(commits), [commits]);

  if (commits.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        No commits yet
      </div>
    );
  }

  const maxLane = Math.max(...layout.map(l => l.lane), 0);
  const graphW = (maxLane + 1) * LANE_W + GRAPH_PAD;
  const totalH = commits.length * ROW_H;

  return (
    <div className="h-full overflow-y-auto overflow-x-auto bg-base select-none">
      <div className="relative" style={{ minWidth: graphW + 400 }}>
        {/* SVG graph lines and circles */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={graphW}
          height={totalH}
        >
          {layout.map(({ lane, row, color, edges }) => (
            <g key={row}>
              {edges.map((edge, i) => {
                const x1 = edge.fromLane * LANE_W + GRAPH_PAD;
                const y1 = row * ROW_H + ROW_H / 2;
                const x2 = edge.toLane * LANE_W + GRAPH_PAD;
                const y2 = edge.toRow * ROW_H + ROW_H / 2;
                const midY = (y1 + y2) / 2;
                return (
                  <path
                    key={i}
                    d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
                    stroke={edge.color}
                    strokeWidth={2}
                    fill="none"
                    opacity={0.7}
                  />
                );
              })}
              <circle
                cx={lane * LANE_W + GRAPH_PAD}
                cy={row * ROW_H + ROW_H / 2}
                r={4}
                fill={color}
              />
            </g>
          ))}
        </svg>

        {/* Commit rows with text */}
        {layout.map(({ commit, lane, row }) => {
          const isSelected = selectedCommit === commit.hash;
          return (
            <div
              key={commit.hash}
              onClick={() => setSelectedCommit(isSelected ? null : commit.hash)}
              className={`flex items-center cursor-pointer h-7 px-2 transition-colors ${isSelected ? 'bg-surface1' : 'hover:bg-surface0'}`}
              style={{ paddingLeft: graphW }}
            >
              <div className="flex items-center gap-2 min-w-0 w-full pl-2">
                <span className="text-subtext font-mono text-xs shrink-0">{commit.abbreviatedHash}</span>
                <span className="text-text text-xs truncate flex-1">
                  {commit.message}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {commit.refs.slice(0, 3).map(ref => (
                    <span key={ref} className="bg-surface0 text-blue text-xs px-1 rounded">
                      {ref.replace('HEAD -> ', '').slice(0, 15)}
                    </span>
                  ))}
                </div>
                <span className="text-subtext text-xs shrink-0">{relativeTime(commit.date)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
