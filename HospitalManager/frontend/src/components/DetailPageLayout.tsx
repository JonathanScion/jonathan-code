import { Box, Card, Tabs, Tab, CircularProgress, Typography } from '@mui/material';
import { useState } from 'react';

interface TabDef {
  label: string;
  content: React.ReactNode;
}

interface DetailPageLayoutProps {
  header: React.ReactNode;
  tabs: TabDef[];
  loading?: boolean;
  error?: boolean;
}

export default function DetailPageLayout({ header, tabs, loading, error }: DetailPageLayoutProps) {
  const [activeTab, setActiveTab] = useState(0);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="error">Failed to load data.</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {header}
      <Card sx={{ mt: 2 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          {tabs.map((tab, i) => (
            <Tab key={i} label={tab.label} />
          ))}
        </Tabs>
        <Box sx={{ p: 3 }}>
          {tabs[activeTab]?.content}
        </Box>
      </Card>
    </Box>
  );
}
