package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"

	_ "github.com/lib/pq"
)

var updateGoldenFiles = true

// These tests require a real postgres database:
// - make devenv sources=potgres_tests
// - either set the env variable GRAFANA_TEST_DB = postgres
//   - or set `forceRun := true` below
//
// The tests require a PostgreSQL db named grafanadstest and a user/password grafanatest/grafanatest!
// Use the docker/blocks/postgres_tests/docker-compose.yaml to spin up a
// preconfigured Postgres server suitable for running these tests.
func TestIntegrationPostgresSnapshots(t *testing.T) {
	// the logic in this function is copied from postgres_tests.go
	shouldRunTest := func() bool {
		if testing.Short() {
			return false
		}

		testDbName, present := os.LookupEnv("GRAFANA_TEST_DB")

		if present && testDbName == "postgres" {
			return true
		}

		return false
	}

	if !shouldRunTest() {
		t.Skip()
	}

	openDB := func() *sql.DB {
		host := os.Getenv("POSTGRES_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("POSTGRES_PORT")
		if port == "" {
			port = "5432"
		}

		connStr := fmt.Sprintf("user=grafanatest password=grafanatest host=%s port=%s dbname=grafanadstest sslmode=disable",
			host, port)

		db, err := sql.Open("postgres", connStr)
		require.NoError(t, err)
		return db
	}

	makeQuery := func(format string) backend.QueryDataRequest {
		queryData := map[string]string{
			"rawSql": "SELECT * FROM tbl",
			"format": format,
		}

		queryBytes, err := json.Marshal(queryData)
		require.NoError(t, err)

		return backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					JSON:  queryBytes,
					RefID: "A",
				},
			},
		}
	}

	tableQuery := makeQuery("table")
	timeSeriesQuery := makeQuery("time_series")

	tt := []struct {
		name   string
		format string
	}{
		{format: "time_series", name: "simple"},
		{format: "time_series", name: "7x_compat_metric_label"},
		{format: "time_series", name: "convert_to_float64"},
		{format: "table", name: "simple"},
		{format: "table", name: "types_numeric"},
		{format: "table", name: "types_char"},
		{format: "table", name: "types_datetime"},
		{format: "table", name: "types_other"},
		{format: "table", name: "timestamp_convert_bigint"},
		{format: "table", name: "timestamp_convert_integer"},
	}

	for _, test := range tt {
		require.True(t, test.format == "table" || test.format == "time_series")
		t.Run(test.name, func(t *testing.T) {
			origDB := sqleng.NewDB
			origInterpolate := sqleng.Interpolate
			t.Cleanup(func() {
				sqleng.NewDB = origDB
				sqleng.Interpolate = origInterpolate
			})

			sqleng.Interpolate = func(query backend.DataQuery, timeRange backend.TimeRange, timeInterval string, sql string) (string, error) {
				return sql, nil
			}

			db := openDB()

			t.Cleanup((func() {
				_, err := db.Exec("DROP TABLE tbl")
				require.NoError(t, err)
				err = db.Close()
				require.NoError(t, err)
			}))

			sqleng.NewDB = func(d, c string) (*sql.DB, error) {
				return db, nil
			}

			cfg := setting.NewCfg()
			cfg.DataPath = t.TempDir()

			jsonData := sqleng.JsonData{
				MaxOpenConns:        0,
				MaxIdleConns:        2,
				ConnMaxLifetime:     14400,
				Timescaledb:         false,
				ConfigurationMethod: "file-path",
			}

			dsInfo := sqleng.DataSourceInfo{
				JsonData:                jsonData,
				DecryptedSecureJSONData: map[string]string{},
			}

			config := sqleng.DataPluginConfiguration{
				DriverName:        "postgres",
				ConnectionString:  "",
				DSInfo:            dsInfo,
				MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
				RowLimit:          1000000,
			}

			queryResultTransformer := postgresQueryResultTransformer{}

			logger := log.New()
			handler, err := sqleng.NewQueryDataHandler(cfg, config, &queryResultTransformer, newPostgresMacroEngine(dsInfo.JsonData.Timescaledb),
				logger)

			require.NoError(t, err)

			sqlFilePath := filepath.Join("testdata", test.format, test.name+".sql")
			goldenFileName := filepath.Join(test.format, test.name+".golden")

			//nolint:gosec
			sqlBytes, err := os.ReadFile(sqlFilePath)
			require.NoError(t, err)

			sql := string(sqlBytes)

			_, err = db.Exec(sql)
			require.NoError(t, err)

			query := tableQuery
			if test.format == "time_series" {
				query = timeSeriesQuery
			}

			result, err := handler.QueryData(context.Background(), &query)
			require.Len(t, result.Responses, 1)
			response, found := result.Responses["A"]
			require.True(t, found)
			require.NoError(t, err)
			experimental.CheckGoldenJSONResponse(t, "testdata", goldenFileName, &response, updateGoldenFiles)
		})
	}
}
