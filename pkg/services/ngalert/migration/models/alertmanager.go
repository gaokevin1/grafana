package models

import (
	"strings"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
	"github.com/prometheus/common/model"

	apiModels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// Alertmanager is a helper struct for creating migrated alertmanager configs.
type Alertmanager struct {
	config                *apiModels.PostableUserConfig
	legacyRoute           *apiModels.Route
	legacyReceiverToRoute map[string]*apiModels.Route
	legacyUIDToReceiver   map[string]*apiModels.PostableGrafanaReceiver
}

// NewAlertmanager creates a new Alertmanager.
func NewAlertmanager() *Alertmanager {
	return FromPostableUserConfig(nil)
}

// FromPostableUserConfig creates an Alertmanager from a PostableUserConfig.
func FromPostableUserConfig(config *apiModels.PostableUserConfig) *Alertmanager {
	if config == nil {
		// No existing amConfig created from a previous migration.
		config = createBaseConfig()
	}
	if config.AlertmanagerConfig.Route == nil {
		// No existing base route created from a previous migration.
		config.AlertmanagerConfig.Route = createDefaultRoute()
	}
	am := &Alertmanager{
		config:                config,
		legacyRoute:           getOrCreateNestedLegacyRoute(config),
		legacyReceiverToRoute: make(map[string]*apiModels.Route),
		legacyUIDToReceiver:   config.GetGrafanaReceiverMap(),
	}

	for _, r := range am.legacyRoute.Routes {
		am.legacyReceiverToRoute[r.Receiver] = r
	}
	return am
}

// CleanAlertmanager removes the nested legacy route from the base PostableUserConfig if it's empty.
func CleanAlertmanager(am *Alertmanager) *apiModels.PostableUserConfig {
	for i, r := range am.config.AlertmanagerConfig.Route.Routes {
		if isNestedLegacyRoute(r) && len(r.Routes) == 0 {
			// Remove empty nested route.
			am.config.AlertmanagerConfig.Route.Routes = append(am.config.AlertmanagerConfig.Route.Routes[:i], am.config.AlertmanagerConfig.Route.Routes[i+1:]...)
			return am.config
		}
	}
	return am.config
}

// AddRoute adds a route to the alertmanager config.
func (am *Alertmanager) AddRoute(route *apiModels.Route) {
	if route == nil {
		return
	}
	am.legacyReceiverToRoute[route.Receiver] = route
	am.legacyRoute.Routes = append(am.legacyRoute.Routes, route)
}

// AddReceiver adds a receiver to the alertmanager config.
func (am *Alertmanager) AddReceiver(recv *apiModels.PostableGrafanaReceiver) {
	if recv == nil {
		return
	}
	am.config.AlertmanagerConfig.Receivers = append(am.config.AlertmanagerConfig.Receivers, &apiModels.PostableApiReceiver{
		Receiver: config.Receiver{
			Name: recv.Name, // Channel name is unique within an Org.
		},
		PostableGrafanaReceivers: apiModels.PostableGrafanaReceivers{
			GrafanaManagedReceivers: []*apiModels.PostableGrafanaReceiver{recv},
		},
	})
	am.legacyUIDToReceiver[recv.UID] = recv
}

// GetLegacyRoute retrieves the legacy route for a given migrated channel UID.
func (am *Alertmanager) GetLegacyRoute(recv string) (*apiModels.Route, bool) {
	route, ok := am.legacyReceiverToRoute[recv]
	return route, ok
}

// GetReceiver retrieves the receiver for a given UID.
func (am *Alertmanager) GetReceiver(uid string) (*apiModels.PostableGrafanaReceiver, bool) {
	recv, ok := am.legacyUIDToReceiver[uid]
	return recv, ok
}

// GetContactLabel retrieves the label used to route for a given UID.
func (am *Alertmanager) GetContactLabel(uid string) string {
	if recv, ok := am.GetReceiver(uid); ok {
		if route, ok := am.GetLegacyRoute(recv.Name); ok {
			for _, match := range route.ObjectMatchers {
				if match.Type == labels.MatchEqual && strings.HasPrefix(match.Name, ngmodels.MigratedContactLabelPrefix) {
					return match.Name
				}
			}
		}
	}
	return ""
}

// getOrCreateNestedLegacyRoute finds or creates the nested route for migrated channels.
func getOrCreateNestedLegacyRoute(config *apiModels.PostableUserConfig) *apiModels.Route {
	for _, r := range config.AlertmanagerConfig.Route.Routes {
		if isNestedLegacyRoute(r) {
			return r
		}
	}
	nestedLegacyChannelRoute := createNestedLegacyRoute()
	// Add new nested route as the first of the top-level routes.
	config.AlertmanagerConfig.Route.Routes = append([]*apiModels.Route{nestedLegacyChannelRoute}, config.AlertmanagerConfig.Route.Routes...)
	return nestedLegacyChannelRoute
}

// isNestedLegacyRoute checks whether a route is the nested legacy route for migrated channels.
func isNestedLegacyRoute(r *apiModels.Route) bool {
	return len(r.ObjectMatchers) == 1 && r.ObjectMatchers[0].Name == ngmodels.MigratedUseLegacyChannelsLabel
}

// createBaseConfig creates an alertmanager config with the root-level route, default receiver, and nested route
// for migrated channels.
func createBaseConfig() *apiModels.PostableUserConfig {
	defaultRoute := createDefaultRoute()
	return &apiModels.PostableUserConfig{
		AlertmanagerConfig: apiModels.PostableApiAlertingConfig{
			Receivers: []*apiModels.PostableApiReceiver{
				{
					Receiver: config.Receiver{
						Name: "autogen-contact-point-default",
					},
					PostableGrafanaReceivers: apiModels.PostableGrafanaReceivers{
						GrafanaManagedReceivers: []*apiModels.PostableGrafanaReceiver{},
					},
				},
			},
			Config: apiModels.Config{
				Route: defaultRoute,
			},
		},
	}
}

// createDefaultRoute creates a default root-level route and associated nested route that will contain all the migrated channels.
func createDefaultRoute() *apiModels.Route {
	nestedRoute := createNestedLegacyRoute()
	return &apiModels.Route{
		Receiver:       "autogen-contact-point-default",
		Routes:         []*apiModels.Route{nestedRoute},
		GroupByStr:     []string{ngmodels.FolderTitleLabel, model.AlertNameLabel}, // To keep parity with pre-migration notifications.
		RepeatInterval: nil,
	}
}

// createNestedLegacyRoute creates a nested route that will contain all the migrated channels.
// This route is matched on the UseLegacyChannelsLabel and mostly exists to keep the migrated channels separate and organized.
func createNestedLegacyRoute() *apiModels.Route {
	mat, _ := labels.NewMatcher(labels.MatchEqual, ngmodels.MigratedUseLegacyChannelsLabel, "true")
	return &apiModels.Route{
		ObjectMatchers: apiModels.ObjectMatchers{mat},
		Continue:       true,
	}
}
