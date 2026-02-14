#!/usr/bin/env python3

import json
import os
import sys

import sqlitecloud


def serialize_row(cursor: sqlitecloud.Cursor, row):
    if row is None:
        return None
    description = cursor.description
    if description:
        columns = [column[0] for column in description]
        return {columns[index]: row[index] for index in range(len(columns))}
    if isinstance(row, (tuple, list)):
        if len(row) == 1:
            return row[0]
        return list(row)
    return row


def run_exec(conn: sqlitecloud.Connection, sql: str):
    statements = [statement.strip() for statement in sql.split(";") if statement.strip()]
    for statement in statements:
        conn.execute(statement)
    conn.commit()
    return {"ok": True}


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except json.JSONDecodeError:
        print(json.dumps({"ok": False, "error": "Invalid JSON payload."}))
        return 1

    connection_url = payload.get("url") or os.environ.get("FIELD_SCOUT_SQLITECLOUD_URL")
    if not connection_url:
        print(json.dumps({"ok": False, "error": "Missing SQLiteCloud connection URL."}))
        return 1

    operation = payload.get("op")
    sql = payload.get("sql")
    params = payload.get("params", [])

    if operation not in {"exec", "run", "get", "all"}:
        print(json.dumps({"ok": False, "error": f"Unsupported operation: {operation}"}))
        return 1
    if not isinstance(sql, str) or not sql.strip():
        print(json.dumps({"ok": False, "error": "Missing SQL statement."}))
        return 1
    if not isinstance(params, list):
        print(json.dumps({"ok": False, "error": "Params must be an array."}))
        return 1

    conn = sqlitecloud.connect(connection_url)
    try:
        if operation == "exec":
            output = run_exec(conn, sql)
        elif operation == "run":
            cursor = conn.execute(sql, tuple(params))
            conn.commit()
            output = {"ok": True, "rowcount": cursor.rowcount}
        elif operation == "get":
            cursor = conn.execute(sql, tuple(params))
            row = cursor.fetchone()
            output = {"ok": True, "row": serialize_row(cursor, row)}
        else:
            cursor = conn.execute(sql, tuple(params))
            rows = cursor.fetchall() or []
            output = {"ok": True, "rows": [serialize_row(cursor, row) for row in rows]}
    except Exception as error:  # pragma: no cover
        output = {"ok": False, "error": str(error)}
    finally:
        conn.close()

    print(json.dumps(output, default=str))
    return 0 if output.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
