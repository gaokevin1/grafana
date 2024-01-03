import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { HorizontalGroup, Icon, Tag, Tooltip } from '@grafana/ui/src';
import { Page } from 'app/core/components/Page/Page';
import { Trans, t } from 'app/core/internationalization';

import { useGetActiveUsersQuery } from '../../dashboard/api/publicDashboardApi';

import { DashboardsListModalButton } from './DashboardsListModalButton';
import { DeleteUserModalButton } from './DeleteUserModalButton';

const selectors = e2eSelectors.pages.UserListPage.publicDashboards;

export const UserListPublicDashboardPage = () => {
  const { data: users, isLoading } = useGetActiveUsersQuery();

  return (
    <Page.Contents isLoading={isLoading}>
      <table className="filter-table form-inline" data-testid={selectors.container}>
        <thead>
          <tr>
            <th>
              <Trans i18nKey="user-list-public-dashboard-page.public-dashboard.email-header">Email</Trans>
            </th>
            <th>
              <span>
                <Trans i18nKey="user-list-public-dashboard-page.public-dashboard.activated-header">Activated</Trans>
              </span>
              <Tooltip
                placement="top"
                content={t(
                  'user-list-public-dashboard-page.public-dashboard.earliest-active-user-time-tooltip-desc',
                  'Earliest time user has been an active user to a dashboard'
                )}
              >
                <Icon name="question-circle" />
              </Tooltip>
            </th>
            <th>
              <Trans i18nKey="user-list-public-dashboard-page.public-dashboard.last-active-header">Last active</Trans>
            </th>
            <th>
              <Trans i18nKey="user-list-public-dashboard-page.public-dashboard.origin-header">Origin</Trans>
            </th>
            <th>
              <Trans i18nKey="user-list-public-dashboard-page.public-dashboard.role-header">Role</Trans>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users?.map((user) => (
            <tr key={user.email}>
              <td className="max-width-10">
                <span className="ellipsis" title={user.email}>
                  {user.email}
                </span>
              </td>
              <td className="max-width-10">{user.firstSeenAtAge}</td>
              <td className="max-width-10">{user.lastSeenAtAge}</td>
              <td className="max-width-10">
                <HorizontalGroup spacing="sm">
                  <span>{user.totalDashboards} dashboard(s)</span>
                  <DashboardsListModalButton email={user.email} />
                </HorizontalGroup>
              </td>
              <td className="max-width-10">
                <Tag name="Viewer" colorIndex={19} />
              </td>
              <td className="text-right">
                <DeleteUserModalButton user={user} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Page.Contents>
  );
};
