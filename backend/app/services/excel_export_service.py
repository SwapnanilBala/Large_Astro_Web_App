from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import text

from app.config import Settings
from app.db.session import get_engine


class ExcelExportService:
    def __init__(self, settings: Settings) -> None:
        self._export_path = settings.excel_export_path

    def export_user_workspace(self, user_id: str) -> str:
        Path(self._export_path).parent.mkdir(parents=True, exist_ok=True)
        engine = get_engine()

        wb = Workbook()
        ws_saved_charts = wb.active
        ws_saved_charts.title = "Saved Charts"
        self._write_query(
            engine,
            ws_saved_charts,
            """
            SELECT
              name,
              city,
              birth_date,
              birth_time,
              timezone_offset_minutes,
              country,
              state,
              town,
              latitude,
              longitude,
              time_zone_id,
              ascendant_sign,
              notes,
              saved_at,
              updated_at,
              archived_at
            FROM saved_charts
            WHERE user_id = :user_id
            ORDER BY updated_at DESC
            """,
            {"user_id": user_id},
        )

        ws_saved_comparisons = wb.create_sheet("Saved Comparisons")
        self._write_query(
            engine,
            ws_saved_comparisons,
            """
            SELECT
              primary_name,
              partner_name,
              compatibility_score,
              summary,
              notes,
              saved_at,
              updated_at,
              archived_at
            FROM saved_comparisons
            WHERE user_id = :user_id
            ORDER BY updated_at DESC
            """,
            {"user_id": user_id},
        )

        header_font = Font(bold=True, color="FFFFFF")
        header_fill = PatternFill(start_color="1B3144", end_color="1B3144", fill_type="solid")

        for ws in wb.worksheets:
            if ws.max_row and ws[1]:
                for cell in ws[1]:
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = Alignment(horizontal="center")
                for col in ws.columns:
                    max_length = max(len(str(cell.value or "")) for cell in col)
                    ws.column_dimensions[col[0].column_letter].width = min(max_length + 4, 50)

        wb.save(self._export_path)
        return self._export_path

    @staticmethod
    def _write_query(engine, ws, query: str, params: dict) -> None:
        with engine.connect() as connection:
            result = connection.execute(text(query), params)
            columns = list(result.keys())
            ws.append(columns)
            for row in result.mappings():
                ws.append([row.get(column) for column in columns])
