import { useCallback, useMemo, useState } from 'react';
import { TagEditor } from '@/components/design-system/molecules/TagEditor/TagEditor';
import { ProjectBreakdown } from '@/components/design-system/organisms/ProjectBreakdown/ProjectBreakdown';
import { SessionDetail } from '@/components/design-system/organisms/SessionDetail/SessionDetail';
import { SessionSearchStrip } from '@/components/design-system/organisms/SessionSearchStrip/SessionSearchStrip';
import { SessionStatsGrid } from '@/components/design-system/organisms/SessionStatsGrid/SessionStatsGrid';
import { SessionTable } from '@/components/design-system/organisms/SessionTable/SessionTable';
import { TagBreakdown } from '@/components/design-system/organisms/TagBreakdown/TagBreakdown';
import { TranscriptPane } from '@/components/design-system/organisms/TranscriptPane/TranscriptPane';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import type { TagMap } from '@/hooks/useTags';
import type { ProjectSort } from '@/lib/views/sessions';
import { Specimen } from '../../Specimen/Specimen';
import {
  INITIAL_TAGS,
  PROJECT_STATE_VIEWS,
  SEARCH_STATE_VIEWS,
  STATS_VIEWS,
  TABLE_STATE_VIEWS,
  TAG_STATE_VIEWS,
  TAG_SUGGESTIONS,
  TRANSCRIPT_VIEWS,
  detailView,
  projectsView,
  searchView,
  tableView,
  tagsView,
  transcriptView,
} from './utils';

function ignore(): void {}

export function SessionsSpecimens() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [sort, setSort] = useState<ProjectSort>('cost');
  const [tags, setTags] = useState<TagMap>(INITIAL_TAGS);
  const [looseTags, setLooseTags] = useState<string[]>(['client-a']);

  const onQueryChange = useCallback((next: string) => {
    setQuery(next);
    setPage(1);
  }, []);
  const onOpen = useCallback((sessionId: string) => {
    setSelectedId(sessionId);
    setTranscriptOpen(false);
  }, []);
  const onClose = useCallback(() => setSelectedId(null), []);
  const onToggleTranscript = useCallback(() => setTranscriptOpen((open) => !open), []);
  const onTagsChange = useCallback((path: string, next: string[]) => {
    setTags((current) => {
      const updated = { ...current };
      if (next.length > 0) updated[path] = [...new Set(next)];
      else delete updated[path];
      return updated;
    });
  }, []);

  const search = useMemo(() => searchView(query), [query]);
  const table = useMemo(() => tableView(query, page, selectedId), [query, page, selectedId]);
  const detail = useMemo(() => detailView(selectedId), [selectedId]);
  const transcript = useMemo(() => transcriptView(transcriptOpen), [transcriptOpen]);
  const projects = useMemo(() => projectsView(sort, tags), [sort, tags]);
  const tagBreakdown = useMemo(() => tagsView(tags), [tags]);

  return (
    <>
      <Specimen name="SessionStatsGrid" note="Both platforms with the split line, then loading and failed" layout="stack">
        {STATS_VIEWS.map((view, index) => (
          <StatGridLayout key={index}>
            <SessionStatsGrid view={view} />
          </StatGridLayout>
        ))}
      </Specimen>
      <Specimen name="SessionSearchStrip" note="Type three characters for the matches. Then searching, no match and failed." layout="stack">
        <SessionSearchStrip view={search} onQueryChange={onQueryChange} onOpen={onOpen} />
        <SplitLayout columns={3}>
          {SEARCH_STATE_VIEWS.map((view, index) => (
            <SessionSearchStrip key={index} view={view} onQueryChange={ignore} onOpen={ignore} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen
        name="SessionTable and SessionDetail"
        note="The search above filters it. A row opens the detail dialog. Then loading, empty and failed."
        layout="stack"
      >
        <SessionTable view={table} onOpen={onOpen} onPageChange={setPage} />
        <SplitLayout columns={3}>
          {TABLE_STATE_VIEWS.map((view, index) => (
            <SessionTable key={index} view={view} onOpen={ignore} onPageChange={ignore} />
          ))}
        </SplitLayout>
        <SessionDetail
          view={detail}
          transcript={transcript}
          onClose={onClose}
          onToggleTranscript={onToggleTranscript}
          onRetryTranscript={ignore}
        />
      </Specimen>
      <Specimen name="TranscriptPane" note="A truncated transcript with tool calls and a step with no text, then loading, failed, archived and empty" layout="stack">
        {TRANSCRIPT_VIEWS.map((specimen) => (
          <TranscriptPane key={specimen.key} view={specimen.view} onRetry={ignore} />
        ))}
      </Specimen>
      <Specimen name="ProjectBreakdown and TagBreakdown" note="Sorting and tag edits update both cards. Then loading, empty and failed." layout="stack">
        <SplitLayout ratio="2:1">
          <ProjectBreakdown view={projects} onSortChange={setSort} onTagsChange={onTagsChange} />
          <TagBreakdown view={tagBreakdown} />
        </SplitLayout>
        <SplitLayout columns={3}>
          {PROJECT_STATE_VIEWS.map((view, index) => (
            <ProjectBreakdown key={index} view={view} onSortChange={ignore} onTagsChange={ignore} />
          ))}
        </SplitLayout>
        <SplitLayout columns={3}>
          {TAG_STATE_VIEWS.map((view, index) => (
            <TagBreakdown key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="TagEditor" note="Add, rename by clicking a name, remove. Existing tags are offered while adding." layout="stack">
        <TagEditor label="Tags for the sample project" value={looseTags} suggestions={TAG_SUGGESTIONS} onChange={setLooseTags} />
      </Specimen>
    </>
  );
}
