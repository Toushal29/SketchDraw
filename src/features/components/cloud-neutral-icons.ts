import {
  mdiAccountKey, mdiApi, mdiArchive, mdiBackupRestore, mdiBrain, mdiCalendarClock,
  mdiCallMerge, mdiCallSplit, mdiFilter, mdiInboxArrowDown, mdiMessageArrowRight,
  mdiChartLine, mdiChartTimelineVariant, mdiCloudSync, mdiCube, mdiDatabase,
  mdiDatabaseArrowDown, mdiDatabaseOutline, mdiDns, mdiDocker, mdiEarth,
  mdiFileDocument, mdiFolderNetwork, mdiHarddisk, mdiKey, mdiKeyChain,
  mdiKubernetes, mdiLan, mdiLayers, mdiMagnify, mdiMemory, mdiMessageProcessing,
  mdiPackageVariant, mdiScaleBalance, mdiServer, mdiShieldCheck, mdiShieldLock,
  mdiSwapHorizontal, mdiCogSync, mdiSourceBranch,
  mdiSitemap, mdiTextBoxSearch, mdiTransitConnectionVariant, mdiWaves, mdiWebhook,
} from "@mdi/js";

/** Material Design Icons paths are 24 × 24 and are shared by canvas and SVG export. */
const paths: Record<string, string> = {
  "cloud-kubernetes": mdiKubernetes,
  "cloud-container": mdiDocker,
  "cloud-compute-instance": mdiServer,
  "cloud-machine-learning": mdiBrain,
  "cloud-api-gateway": mdiApi,
  "cloud-load-balancer": mdiScaleBalance,
  "cloud-cdn": mdiEarth,
  "cloud-dns": mdiDns,
  "cloud-firewall": mdiShieldLock,
  "cloud-network": mdiLan,
  "cloud-event-bus": mdiTransitConnectionVariant,
  "cloud-topic": mdiMessageProcessing,
  "cloud-stream-processing": mdiWaves,
  "cloud-workflow": mdiSitemap,
  "cloud-scheduler": mdiCalendarClock,
  "cloud-cache": mdiMemory,
  "cloud-file-storage": mdiFolderNetwork,
  "cloud-block-storage": mdiHarddisk,
  "cloud-document-database": mdiFileDocument,
  "cloud-time-series-database": mdiChartTimelineVariant,
  "cloud-data-lake": mdiDatabaseArrowDown,
  "cloud-data-warehouse": mdiDatabase,
  "cloud-search": mdiMagnify,
  "cloud-secret-store": mdiKey,
  "cloud-key-management": mdiKeyChain,
  "cloud-identity": mdiAccountKey,
  "cloud-container-registry": mdiPackageVariant,
  "cloud-backup": mdiBackupRestore,
  "cloud-monitoring": mdiChartLine,
  "cloud-logging": mdiTextBoxSearch,
  "cloud-pod": mdiCube,
  "cloud-deployment": mdiLayers,
  "cloud-service-discovery": mdiLan,
  "cloud-ingress": mdiEarth,
  "cloud-config-map": mdiFileDocument,
  "cloud-persistent-volume": mdiHarddisk,
  "cloud-webhook": mdiWebhook,
  "cloud-audit-log": mdiTextBoxSearch,
  "cloud-certificate": mdiShieldCheck,
  "cloud-artifact-store": mdiArchive,
  "cloud-replication": mdiCloudSync,
  "cloud-relational-database": mdiDatabaseOutline,
  "cloud-message-router": mdiSourceBranch,
  "cloud-message-filter": mdiFilter,
  "cloud-message-splitter": mdiCallSplit,
  "cloud-message-aggregator": mdiCallMerge,
  "cloud-message-transformer": mdiSwapHorizontal,
  "cloud-dead-letter-queue": mdiInboxArrowDown,
  "cloud-message-channel": mdiMessageArrowRight,
  "cloud-retry-policy": mdiCogSync,
};

export const cloudNeutralIconPath = (kind: string): string | undefined => paths[kind];

const canvasPaths = new Map<string, Path2D>();
export function cloudNeutralCanvasPath(kind: string): Path2D | undefined {
  const source = paths[kind];
  if (!source) return undefined;
  let path = canvasPaths.get(kind);
  if (!path) { path = new Path2D(source); canvasPaths.set(kind, path); }
  return path;
}
