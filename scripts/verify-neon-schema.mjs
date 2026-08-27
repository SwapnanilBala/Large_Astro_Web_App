import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL is required.");
}

const expectedTables = [
  "assets",
  "audit_events",
  "birth_profiles",
  "chart_aspects",
  "chart_calculations",
  "chart_findings",
  "chart_houses",
  "chart_placements",
  "client_notes",
  "client_tags",
  "clients",
  "compatibility_reports",
  "consent_records",
  "consultations",
  "dasha_periods",
  "generated_artifacts",
  "tags",
  "workspace_members",
  "workspaces",
];

const sql = neon(databaseUrl);
const liveTables = await sql.query(
  "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
);
const liveTableNames = liveTables.map(({ table_name: tableName }) => tableName);
const missingTables = expectedTables.filter((tableName) => !liveTableNames.includes(tableName));

if (missingTables.length > 0) {
  throw new Error(`Missing database tables: ${missingTables.join(", ")}`);
}

await sql.query(`
DO $schema_verification$
DECLARE
  workspace_one uuid := gen_random_uuid();
  workspace_two uuid := gen_random_uuid();
  client_one uuid := gen_random_uuid();
  client_partner uuid := gen_random_uuid();
  client_other_workspace uuid := gen_random_uuid();
  birth_one uuid := gen_random_uuid();
  birth_partner uuid := gen_random_uuid();
  birth_other_workspace uuid := gen_random_uuid();
  chart_one uuid := gen_random_uuid();
  chart_partner uuid := gen_random_uuid();
  chart_other_workspace uuid := gen_random_uuid();
  consultation_one uuid := gen_random_uuid();
  note_one uuid := gen_random_uuid();
  tag_one uuid := gen_random_uuid();
  asset_one uuid := gen_random_uuid();
  artifact_one uuid := gen_random_uuid();
  audit_one uuid := gen_random_uuid();
  invalid_phone_rejected boolean := false;
  duplicate_consent_rejected boolean := false;
  cross_workspace_link_rejected boolean := false;
BEGIN
  INSERT INTO workspaces (id, name) VALUES
    (workspace_one, 'Codex schema verification'),
    (workspace_two, 'Codex tenant boundary verification');

  INSERT INTO workspace_members (workspace_id, auth_user_id, role)
  VALUES (workspace_one, 'schema-verifier', 'owner');

  INSERT INTO clients (
    id, workspace_id, display_name, email, phone_e164,
    preferred_contact_method, updated_at
  ) VALUES
    (client_one, workspace_one, 'Verification Client', 'verify@example.invalid',
      '+15555550123', 'email', timestamp with time zone '2000-01-01 00:00:00+00'),
    (client_partner, workspace_one, 'Verification Partner', null, null, 'none', now()),
    (client_other_workspace, workspace_two, 'Other Workspace Client', null, null, 'none', now());

  UPDATE clients SET display_name = 'Verification Client Updated' WHERE id = client_one;
  IF (SELECT updated_at <= timestamp with time zone '2000-01-01 00:00:00+00' FROM clients WHERE id = client_one) THEN
    RAISE EXCEPTION 'updated_at trigger did not run';
  END IF;

  BEGIN
    INSERT INTO clients (workspace_id, display_name, phone_e164)
    VALUES (workspace_one, 'Invalid Phone', '555-1234');
  EXCEPTION WHEN check_violation THEN
    invalid_phone_rejected := true;
  END;
  IF NOT invalid_phone_rejected THEN
    RAISE EXCEPTION 'phone constraint did not reject invalid data';
  END IF;

  INSERT INTO birth_profiles (
    id, workspace_id, client_id, birth_date, reported_birth_time, calculation_birth_time,
    birth_time_accuracy, calculation_time_is_fallback, latitude, longitude,
    time_zone_id, resolved_utc_offset_minutes, timezone_source, birth_instant_utc
  ) VALUES
    (birth_one, workspace_one, client_one, date '1990-06-15', null, time '12:00:00',
      'unknown', true, 28.613900, 77.209000, 'Asia/Kolkata', 330,
      'coordinates', timestamp with time zone '1990-06-15 06:30:00+00'),
    (birth_partner, workspace_one, client_partner, date '1992-02-20', time '08:30:00', time '08:30:00',
      'exact', false, 40.712800, -74.006000, 'America/New_York', -300,
      'coordinates', timestamp with time zone '1992-02-20 13:30:00+00'),
    (birth_other_workspace, workspace_two, client_other_workspace, date '1988-10-10', null, time '12:00:00',
      'unknown', true, 51.507400, -0.127800, 'Europe/London', 60,
      'coordinates', timestamp with time zone '1988-10-10 11:00:00+00');

  INSERT INTO chart_calculations (
    id, workspace_id, birth_profile_id, input_fingerprint, input_snapshot_json,
    engine_id, calculation_version, ascendant_sign, sun_sign, moon_sign
  ) VALUES
    (chart_one, workspace_one, birth_one, repeat('a', 64), '{"source":"verification"}'::jsonb,
      'verification-engine', '1', 'Aries', 'Gemini', 'Cancer'),
    (chart_partner, workspace_one, birth_partner, repeat('b', 64), '{"source":"verification"}'::jsonb,
      'verification-engine', '1', 'Taurus', 'Pisces', 'Leo'),
    (chart_other_workspace, workspace_two, birth_other_workspace, repeat('c', 64), '{"source":"verification"}'::jsonb,
      'verification-engine', '1', 'Virgo', 'Libra', 'Scorpio');

  INSERT INTO chart_placements (
    workspace_id, chart_id, point_code, longitude, sign_code, degree_in_sign, house_number
  ) VALUES (workspace_one, chart_one, 'Sun', 75.25, 'Gemini', 15.25, 3);

  INSERT INTO chart_houses (workspace_id, chart_id, house_number, sign_code, cusp_longitude)
  VALUES (workspace_one, chart_one, 1, 'Aries', 10.5);

  INSERT INTO chart_aspects (
    workspace_id, chart_id, from_point, to_point, aspect_type, exact_angle, orb
  ) VALUES (workspace_one, chart_one, 'Sun', 'Moon', 'square', 90, 1.25);

  INSERT INTO dasha_periods (workspace_id, chart_id, level, lord, start_at, end_at)
  VALUES (workspace_one, chart_one, 1, 'Venus', now(), now() + interval '1 year');

  INSERT INTO chart_findings (
    workspace_id, chart_id, instance_key, rule_id, category, tier,
    priority, strength, score, selected, rank
  ) VALUES (
    workspace_one, chart_one, 'verification.finding', 'verification.rule',
    'core', 'foundation', 'high', 0.8, 0.7, true, 1
  );

  INSERT INTO consultations (id, workspace_id, client_id, chart_id, consultation_type)
  VALUES (consultation_one, workspace_one, client_one, chart_one, 'natal');

  INSERT INTO client_notes (id, workspace_id, client_id, consultation_id, body)
  VALUES (note_one, workspace_one, client_one, consultation_one, 'Schema verification note');

  INSERT INTO tags (id, workspace_id, name) VALUES (tag_one, workspace_one, 'Verification');
  INSERT INTO client_tags (workspace_id, client_id, tag_id)
  VALUES (workspace_one, client_one, tag_one);

  INSERT INTO compatibility_reports (
    workspace_id, primary_client_id, partner_client_id, primary_chart_id,
    partner_chart_id, compatibility_score, algorithm_version, input_fingerprint
  ) VALUES (
    workspace_one, client_one, client_partner, chart_one, chart_partner,
    82.50, 'verification-1', repeat('d', 64)
  );

  INSERT INTO assets (
    id, workspace_id, client_id, storage_provider, object_key,
    mime_type, byte_size, sha256
  ) VALUES (
    asset_one, workspace_one, client_one, 'verification',
    'schema-verification/object', 'application/pdf', 100, repeat('e', 64)
  );

  INSERT INTO generated_artifacts (
    id, workspace_id, client_id, chart_id, consultation_id,
    source_asset_id, output_asset_id, artifact_type, generator_version
  ) VALUES (
    artifact_one, workspace_one, client_one, chart_one, consultation_one,
    asset_one, asset_one, 'verification_report', '1'
  );

  INSERT INTO consent_records (
    workspace_id, client_id, purpose, policy_version, granted_at, capture_source
  ) VALUES (
    workspace_one, client_one, 'birth_data_processing', 'verification-1', now(), 'admin'
  );

  BEGIN
    INSERT INTO consent_records (
      workspace_id, client_id, purpose, policy_version, granted_at, capture_source
    ) VALUES (
      workspace_one, client_one, 'birth_data_processing', 'verification-1', now(), 'admin'
    );
  EXCEPTION WHEN unique_violation THEN
    duplicate_consent_rejected := true;
  END;
  IF NOT duplicate_consent_rejected THEN
    RAISE EXCEPTION 'active-consent uniqueness was not enforced';
  END IF;

  INSERT INTO audit_events (
    id, workspace_id, actor_auth_user_id, client_id, entity_type, entity_id, action
  ) VALUES (
    audit_one, workspace_one, 'schema-verifier', client_one, 'client', client_one, 'verified'
  );

  BEGIN
    UPDATE consultations SET chart_id = chart_other_workspace WHERE id = consultation_one;
  EXCEPTION WHEN foreign_key_violation THEN
    cross_workspace_link_rejected := true;
  END;
  IF NOT cross_workspace_link_rejected THEN
    RAISE EXCEPTION 'cross-workspace optional link was not rejected';
  END IF;

  DELETE FROM chart_calculations WHERE id = chart_one;
  IF (SELECT chart_id IS NOT NULL FROM consultations WHERE id = consultation_one) THEN
    RAISE EXCEPTION 'chart delete did not clear consultation link';
  END IF;
  IF (SELECT chart_id IS NOT NULL FROM generated_artifacts WHERE id = artifact_one) THEN
    RAISE EXCEPTION 'chart delete did not clear artifact link';
  END IF;

  DELETE FROM consultations WHERE id = consultation_one;
  IF (SELECT consultation_id IS NOT NULL FROM client_notes WHERE id = note_one) THEN
    RAISE EXCEPTION 'consultation delete did not clear note link';
  END IF;
  IF (SELECT consultation_id IS NOT NULL FROM generated_artifacts WHERE id = artifact_one) THEN
    RAISE EXCEPTION 'consultation delete did not clear artifact link';
  END IF;

  DELETE FROM assets WHERE id = asset_one;
  IF (SELECT source_asset_id IS NOT NULL OR output_asset_id IS NOT NULL FROM generated_artifacts WHERE id = artifact_one) THEN
    RAISE EXCEPTION 'asset delete did not clear artifact links';
  END IF;

  DELETE FROM clients WHERE id = client_one;
  IF (SELECT client_id IS NOT NULL FROM audit_events WHERE id = audit_one) THEN
    RAISE EXCEPTION 'client delete did not preserve a sanitized audit event';
  END IF;

  DELETE FROM workspaces WHERE id IN (workspace_one, workspace_two);
END;
$schema_verification$;
`);

const [{ remaining_test_rows: remainingTestRows }] = await sql.query(
  "select count(*)::int as remaining_test_rows from workspaces where name like 'Codex % verification'",
);

if (remainingTestRows !== 0) {
  throw new Error("Database verification left temporary rows behind.");
}

const [{ migration_count: migrationCount }] = await sql.query(
  "select count(*)::int as migration_count from drizzle.__drizzle_migrations",
);

console.log(
  JSON.stringify({
    database: "connected",
    tables: liveTableNames.length,
    migrations: migrationCount,
    smokeTest: "passed",
    temporaryRowsRemaining: remainingTestRows,
  }),
);
