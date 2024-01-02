// Prometheus API DTOs, possibly to be autogenerated from openapi spec in the near future

import { DataQuery, RelativeTimeRange } from '@grafana/data';
import { AlertManagerManualRouting } from 'app/features/alerting/unified/types/rule-form';

import { AlertGroupTotals } from './unified-alerting';

export type Labels = Record<string, string>;
export type Annotations = Record<string, string>;

export enum PromAlertingRuleState {
  Firing = 'firing',
  Inactive = 'inactive',
  Pending = 'pending',
}

export enum GrafanaAlertState {
  Normal = 'Normal',
  Alerting = 'Alerting',
  Pending = 'Pending',
  NoData = 'NoData',
  Error = 'Error',
}

type GrafanaAlertStateReason = ` (${string})` | '';

export type GrafanaAlertStateWithReason = `${GrafanaAlertState}${GrafanaAlertStateReason}`;

export function isPromAlertingRuleState(state: string): state is PromAlertingRuleState {
  return Object.values<string>(PromAlertingRuleState).includes(state);
}

export function isGrafanaAlertState(state: string): state is GrafanaAlertState {
  return Object.values(GrafanaAlertState).some((promState) => promState === state);
}

/** We need this to disambiguate the union PromAlertingRuleState | GrafanaAlertStateWithReason
 */
export function isAlertStateWithReason(
  state: PromAlertingRuleState | GrafanaAlertStateWithReason
): state is GrafanaAlertStateWithReason {
  const propAlertingRuleStateValues: string[] = Object.values(PromAlertingRuleState);
  return state !== null && state !== undefined && !propAlertingRuleStateValues.includes(state);
}

export function mapStateWithReasonToBaseState(
  state: GrafanaAlertStateWithReason | PromAlertingRuleState
): GrafanaAlertState | PromAlertingRuleState {
  if (isAlertStateWithReason(state)) {
    const fields = state.split(' ');
    return fields[0] as GrafanaAlertState;
  } else {
    return state;
  }
}

export enum PromRuleType {
  Alerting = 'alerting',
  Recording = 'recording',
}

export enum PromApplication {
  Cortex = 'Cortex',
  Mimir = 'Mimir',
  Prometheus = 'Prometheus',
  Thanos = 'Thanos',
}

export interface PromBuildInfoResponse {
  data: {
    application?: string;
    version: string;
    revision: string;
    features?: {
      ruler_config_api?: 'true' | 'false';
      alertmanager_config_api?: 'true' | 'false';
      query_sharding?: 'true' | 'false';
      federated_rules?: 'true' | 'false';
    };
    [key: string]: unknown;
  };
  status: 'success';
}

export interface PromApiFeatures {
  application?: PromApplication;
  features: {
    rulerApiEnabled: boolean;
  };
}

export interface AlertmanagerApiFeatures {
  /**
   * Some Alertmanager implementations (Mimir) are multi-tenant systems.
   *
   * To save on compute costs, tenants are not active until they have a configuration set.
   * If there is no fallback_config_file set, Alertmanager endpoints will respond with HTTP 404
   *
   * Despite that, it is possible to create a configuration for such datasource
   * by posting a new config to the `/api/v1/alerts` endpoint
   */
  lazyConfigInit: boolean;
}

interface PromRuleDTOBase {
  health: string;
  name: string;
  query: string; // expr
  evaluationTime?: number;
  lastEvaluation?: string;
  lastError?: string;
}

export interface PromAlertingRuleDTO extends PromRuleDTOBase {
  alerts?: Array<{
    labels: Labels;
    annotations: Annotations;
    state: Exclude<PromAlertingRuleState | GrafanaAlertStateWithReason, PromAlertingRuleState.Inactive>;
    activeAt: string;
    value: string;
  }>;
  labels: Labels;
  annotations?: Annotations;
  duration?: number; // for
  state: PromAlertingRuleState;
  type: PromRuleType.Alerting;
}

export interface PromRecordingRuleDTO extends PromRuleDTOBase {
  health: string;
  name: string;
  query: string; // expr
  type: PromRuleType.Recording;
  labels?: Labels;
}

export type PromRuleDTO = PromAlertingRuleDTO | PromRecordingRuleDTO;

export interface PromRuleGroupDTO {
  name: string;
  file: string;
  rules: PromRuleDTO[];
  interval: number;

  evaluationTime?: number; // these 2 are not in older prometheus payloads
  lastEvaluation?: string;
}

export interface PromResponse<T> {
  status: 'success' | 'error' | ''; // mocks return empty string
  data: T;
  errorType?: string;
  error?: string;
  warnings?: string[];
}

export type PromRulesResponse = PromResponse<{
  groups: PromRuleGroupDTO[];
  totals?: AlertGroupTotals;
}>;

// Ruler rule DTOs
interface RulerRuleBaseDTO {
  expr: string;
  labels?: Labels;
}

export interface RulerRecordingRuleDTO extends RulerRuleBaseDTO {
  record: string;
}

export interface RulerAlertingRuleDTO extends RulerRuleBaseDTO {
  alert: string;
  for?: string;
  keep_firing_for?: string;
  annotations?: Annotations;
}

export enum GrafanaAlertStateDecision {
  Alerting = 'Alerting',
  NoData = 'NoData',
  KeepLastState = 'KeepLastState',
  OK = 'OK',
  Error = 'Error',
}

export interface AlertDataQuery extends DataQuery {
  maxDataPoints?: number;
  intervalMs?: number;
  expression?: string;
}

export interface AlertQuery {
  refId: string;
  queryType: string;
  relativeTimeRange?: RelativeTimeRange;
  datasourceUid: string;
  model: AlertDataQuery;
}

export interface PostableGrafanaRuleDefinition {
  uid?: string;
  title: string;
  condition: string;
  no_data_state: GrafanaAlertStateDecision;
  exec_err_state: GrafanaAlertStateDecision;
  data: AlertQuery[];
  is_paused?: boolean;
  contactPoints?: AlertManagerManualRouting;
}
export interface GrafanaRuleDefinition extends PostableGrafanaRuleDefinition {
  id?: string;
  uid: string;
  namespace_uid: string;
  provenance?: string;
}

export interface RulerGrafanaRuleDTO {
  grafana_alert: GrafanaRuleDefinition;
  for: string;
  annotations: Annotations;
  labels: Labels;
}

export interface PostableRuleGrafanaRuleDTO {
  grafana_alert: PostableGrafanaRuleDefinition;
  for: string;
  annotations: Annotations;
  labels: Labels;
}

export type RulerRuleDTO = RulerAlertingRuleDTO | RulerRecordingRuleDTO | RulerGrafanaRuleDTO;

export type PostableRuleDTO = RulerAlertingRuleDTO | RulerRecordingRuleDTO | PostableRuleGrafanaRuleDTO;

export type RulerRuleGroupDTO<R = RulerRuleDTO> = {
  name: string;
  interval?: string;
  source_tenants?: string[];
  rules: R[];
};

export type PostableRulerRuleGroupDTO = RulerRuleGroupDTO<PostableRuleDTO>;

export type RulerRulesConfigDTO = { [namespace: string]: RulerRuleGroupDTO[] };
