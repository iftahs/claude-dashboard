import { useCallback, useState } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { CardHeader } from '@/components/design-system/molecules/CardHeader/CardHeader';
import { AppShellLayout } from '@/components/design-system/templates/AppShellLayout/AppShellLayout';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { useTheme } from '@/hooks/useTheme';
import { ContentAtoms } from './ContentAtoms/ContentAtoms';
import { ControlAtoms } from './ControlAtoms/ControlAtoms';
import { DataMolecules } from './DataMolecules/DataMolecules';
import { GallerySidebar } from './GallerySidebar/GallerySidebar';
import { GalleryTopbar } from './GalleryTopbar/GalleryTopbar';
import { OrganismSpecimens } from './OrganismSpecimens/OrganismSpecimens';
import { OverlayMolecules } from './OverlayMolecules/OverlayMolecules';
import { SectionParts } from './SectionParts/SectionParts';
import { StatusAtoms } from './StatusAtoms/StatusAtoms';
import { TemplateSpecimens } from './TemplateSpecimens/TemplateSpecimens';
import type { GallerySectionId } from './types';
import { GALLERY_COMPONENT_COUNT, GALLERY_SECTIONS, sectionFromHash } from './utils';

export function DesignSystemPage() {
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeId, setActiveId] = useState<GallerySectionId>(() => sectionFromHash(window.location.hash));

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed((collapsed) => !collapsed), []);
  const navigate = useCallback((id: GallerySectionId) => {
    setActiveId(id);
    setDrawerOpen(false);
  }, []);

  const [atoms, molecules, organisms, templates] = GALLERY_SECTIONS;
  const collapseLabel = sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <AppShellLayout
      sidebarCollapsed={sidebarCollapsed}
      drawerOpen={drawerOpen}
      onDrawerClose={closeDrawer}
      sidebar={
        <GallerySidebar
          sections={GALLERY_SECTIONS}
          activeId={activeId}
          collapsed={sidebarCollapsed && !drawerOpen}
          toggleIcon={drawerOpen ? 'x' : 'panel'}
          toggleLabel={drawerOpen ? 'Close navigation' : collapseLabel}
          onToggle={drawerOpen ? closeDrawer : toggleSidebar}
          onNavigate={navigate}
        />
      }
      topbar={
        <GalleryTopbar
          title="Design system"
          theme={theme}
          drawerOpen={drawerOpen}
          onToggleTheme={toggleTheme}
          onOpenDrawer={openDrawer}
        />
      }
    >
      <PageLayout
        header={
          <PageHeader
            description="Every atom, molecule, shared organism and template in its meaningful states. This page exists in development only."
            actions={<Badge>{GALLERY_COMPONENT_COUNT} components</Badge>}
          />
        }
      >
        <SectionStackLayout title={<CardHeader title={atoms.label} titleId={atoms.id} description={atoms.description} className="mb-0" />}>
          <ControlAtoms />
          <StatusAtoms />
          <ContentAtoms />
        </SectionStackLayout>
        <SectionStackLayout
          title={<CardHeader title={molecules.label} titleId={molecules.id} description={molecules.description} className="mb-0" />}
        >
          <DataMolecules />
          <SectionParts />
          <OverlayMolecules />
        </SectionStackLayout>
        <SectionStackLayout
          title={<CardHeader title={organisms.label} titleId={organisms.id} description={organisms.description} className="mb-0" />}
        >
          <OrganismSpecimens />
        </SectionStackLayout>
        <SectionStackLayout
          title={<CardHeader title={templates.label} titleId={templates.id} description={templates.description} className="mb-0" />}
        >
          <TemplateSpecimens
            sidebarCollapsed={sidebarCollapsed}
            drawerOpen={drawerOpen}
            onToggleSidebar={toggleSidebar}
            onOpenDrawer={openDrawer}
          />
        </SectionStackLayout>
      </PageLayout>
    </AppShellLayout>
  );
}
