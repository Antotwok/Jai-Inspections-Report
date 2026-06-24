const path = require('path');
const dotenv = require('dotenv');
const { pool } = require('./database/db');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const CUSTOMER = {
  customer_code: 'MEI',
  customer_name: 'Madras Engineering Industries (P) Limited',
  customer_address: 'Madras Engineering Industries (P) Limited',
  current_report_number: 548
};

const PART = {
  part_name: 'Madras Engineering Sample Part',
  part_number: '721870',
  drawing_number: 'N.A',
  material: 'Carbon Steel',
  date_code: '168611',
  film_series: 'J',
  current_film_number: 50,
  acceptance_standard: 'ASME SEC. V Art.2 & 22'
};

const reportRows = [
  ['721870 - LH - ME - 168611 - J1', '1', 'NSD', 'ACC'],
  ['721870 - LH - ME - 168611 - J2', '1', 'Cc - II', 'ACC'],
  ['721870 - LH - ME - 168611 - J3', '2', 'A - I', 'ACC'],
  ['721870 - LH - ME - 168611 - J4', '2', 'NSD', 'ACC'],
  ['721870 - LH - ME - 168611 - J5', '3', 'Cc - II', 'ACC'],
  ['721870 - LH - ME - 168611 - J6', '3', 'Cc - I', 'ACC'],
  ['721870 - LH - ME - 168611 - J7', '4', 'NSD', 'ACC'],
  ['721870 - LH - ME - 168611 - J8', '4', 'A - II', 'ACC'],
  ['721870 - LH - ME - 168611 - J9', '5', 'Cc - IV', 'REJ'],
  ['721870 - LH - ME - 168611 - J10', '5', 'Cc - I', 'ACC'],
  ['721870 - LH - ME - 168611 - J11', '6', 'NSD', 'ACC'],
  ['721870 - LH - ME - 168611 - J12', '6', 'NSD', 'ACC'],
  ['721870 - LH - ME - 168611 - J13', '7', 'P - I', 'ACC'],
  ['721870 - LH - ME - 168611 - J14', '7', 'NSD', 'ACC'],
  ['721870 - LH - ME - 168611 - J15', '8', 'Cc - II', 'ACC'],
  ['721870 - LH - ME - 168611 - J16', '8', 'NSD', 'ACC'],
  ['721870 - LH - ME - 168611 - J17', '9', 'SL - I', 'ACC'],
  ['721870 - LH - ME - 168611 - J18', '9', 'Cc - II', 'ACC'],
  ['721870 - LH - ME - 168611 - J19', '10', 'NSD', 'ACC'],
  ['721870 - LH - ME - 168611 - J20', '10', 'Cc - II', 'ACC']
];

function reportJson(customerId, partId, reportNo) {
  return {
    reportType: 'NON_NABL',
    reportNo,
    customerId,
    partId,
    customerName: CUSTOMER.customer_name,
    partNumber: PART.part_number,
    dateCode: PART.date_code,
    selectedDateCode: PART.date_code,
    reportDate: '2026-06-23',
    inspectionDate: '2026-06-23',
    density: '2.0 - 3.5',
    sensitivity: '2%',
    customerFields: [
      { label: ' Customer Name & Address *', value: CUSTOMER.customer_name },
      { label: ' Material', value: PART.material },
      { label: ' Size & Thickness *', value: '40mm' },
      { label: ' Area Tested *', value: '100% Radiography' },
      { label: ' Lead Screens', value: '0.15mm ( Front & Back )' },
      { label: ' Exposure Technique', value: 'S W S I' },
      { label: ' Test Method *', value: 'ASME SEC. V Art.2 & 22' },
      { label: ' Acceptance Std. *', value: 'ASME SEC VIII DIV. 1' },
      { label: 'S.F.D', value: '' }
    ],
    reportFields: [
      { label: ' Report No', value: reportNo },
      { label: ' Report Date', value: '23-Jun-2026' },
      { label: ' Test Location', value: CUSTOMER.customer_name },
      { label: ' Source', value: 'Ir-192' },
      { label: ' Source Strength', value: '25.00Ci.' },
      { label: 'Exposure Time', value: 'Minutes' },
      { label: 'Source Size', value: '6 x 16"' },
      { label: ' Film Class & Brand', value: 'AGFA D7' },
      { label: ' Penetrameter', value: 'ASTM 1B' },
      { label: 'Procedure Specification', value: 'ASME SEC - V' }
    ],
    pages: [
      {
        rows: reportRows.map(([description, segment, observation, result], index) => ({
          description,
          thickness: index < 10 ? '40mm' : '38mm',
          segment,
          filmSize: index % 2 === 0 ? '6 x 16"' : '8 x 10"',
          observations: [
            'IQI: ASTM 1B',
            'Film: AGFA D7',
            index < 5 ? 'Density: 2.0 - 3.5' : 'Density: 2.1 - 3.2',
            index % 3 === 0 ? 'Sensitivity: 2%' : 'Sensitivity: 1.8%',
            'Procedure Specification: ASME SEC - V',
            `Observation: ${observation}`
          ].join('\n'),
          results: result
        }))
      }
    ]
  };
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customerResult = await client.query(
      `
        INSERT INTO customers (
          customer_code, current_report_number, customer_name, customer_address, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (customer_code)
        DO UPDATE SET
          current_report_number = EXCLUDED.current_report_number,
          customer_name = EXCLUDED.customer_name,
          customer_address = EXCLUDED.customer_address,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *
      `,
      [CUSTOMER.customer_code, CUSTOMER.current_report_number, CUSTOMER.customer_name, CUSTOMER.customer_address]
    );

    const customerId = customerResult.rows[0].id;

    const existingPart = await client.query(
      'SELECT id FROM customer_parts WHERE customer_id = $1 AND part_number = $2 LIMIT 1',
      [customerId, PART.part_number]
    );

    let partResult;
    if (existingPart.rows.length) {
      partResult = await client.query(
        `
          UPDATE customer_parts
          SET
            part_name = $1,
            drawing_number = $2,
            material = $3,
            date_code = $4,
            film_prefix = $5,
            film_series = $6,
            current_film_number = $7,
            acceptance_standard = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $9
          RETURNING *
        `,
        [
          PART.part_name,
          PART.drawing_number,
          PART.material,
          PART.date_code,
          PART.date_code,
          PART.film_series,
          PART.current_film_number,
          PART.acceptance_standard,
          existingPart.rows[0].id
        ]
      );
    } else {
      partResult = await client.query(
        `
          INSERT INTO customer_parts (
            customer_id, part_name, part_number, drawing_number, material, date_code,
            film_prefix, film_series, current_film_number, acceptance_standard, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
          RETURNING *
        `,
        [
          customerId,
          PART.part_name,
          PART.part_number,
          PART.drawing_number,
          PART.material,
          PART.date_code,
          PART.date_code,
          PART.film_series,
          PART.current_film_number,
          PART.acceptance_standard
        ]
      );
    }

    const partId = partResult.rows[0].id;
    const reportNo = 'JIA / MEI / 0548 / G';
    const payload = reportJson(customerId, partId, reportNo);

    const existingReport = await client.query('SELECT id FROM reports WHERE report_no = $1 LIMIT 1', [reportNo]);
    let reportId;

    if (existingReport.rows.length) {
      const reportResult = await client.query(
        `
          UPDATE reports
          SET
            report_type = $1,
            customer_id = $2,
            customer_name = $3,
            part_id = $4,
            part_number = $5,
            date_code = $6,
            film_prefix = $7,
            film_series = $8,
            sequence_start = $9,
            sequence_end = $10,
            report_date = $11,
            inspection_date = $12,
            density = $13,
            sensitivity = $14,
            status = $15,
            report_json = $16,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $17
          RETURNING *
        `,
        [
          'NON_NABL',
          customerId,
          CUSTOMER.customer_name,
          partId,
          PART.part_number,
          PART.date_code,
          'J',
          'J',
          1,
          20,
          '2026-06-23',
          '2026-06-23',
          '2.0 - 3.5',
          '2%',
          'DRAFT',
          JSON.stringify(payload),
          existingReport.rows[0].id
        ]
      );
      reportId = reportResult.rows[0].id;
    } else {
      const reportResult = await client.query(
        `
          INSERT INTO reports (
            report_type, report_no, customer_id, customer_name, part_id, part_number, date_code,
            film_prefix, film_series, sequence_start, sequence_end, report_date, inspection_date,
            density, sensitivity, status, report_json, created_at, updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
          RETURNING *
        `,
        [
          'NON_NABL',
          reportNo,
          customerId,
          CUSTOMER.customer_name,
          partId,
          PART.part_number,
          PART.date_code,
          'J',
          'J',
          1,
          20,
          '2026-06-23',
          '2026-06-23',
          '2.0 - 3.5',
          '2%',
          'DRAFT',
          JSON.stringify(payload)
        ]
      );
      reportId = reportResult.rows[0].id;
    }
    await client.query('DELETE FROM report_rows WHERE report_id = $1', [reportId]);

    for (let index = 0; index < payload.pages[0].rows.length; index += 1) {
      const row = payload.pages[0].rows[index];
      await client.query(
        `
          INSERT INTO report_rows (
            report_id, row_order, film_identification, thickness, segment, film_size,
            observation, result, row_data
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          reportId,
          index,
          row.description,
          row.thickness,
          row.segment,
          row.filmSize,
          row.observations,
          row.results,
          JSON.stringify(row)
        ]
      );
    }

    await client.query(
      `
        INSERT INTO customer_part_sequences (
          customer_id, part_number, sequence_prefix, current_sequence, last_report_no, remarks, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT (customer_id, part_number)
        DO UPDATE SET
          sequence_prefix = EXCLUDED.sequence_prefix,
          current_sequence = EXCLUDED.current_sequence,
          last_report_no = EXCLUDED.last_report_no,
          remarks = EXCLUDED.remarks,
          updated_at = CURRENT_TIMESTAMP
      `,
        [customerId, PART.part_number, 'J', 50, reportNo, 'Seeded Madras Engineering sample set']
    );

    await client.query(
      `
        INSERT INTO part_datecode_sequences (
          part_number, date_code, current_sequence, created_at, updated_at
        )
        VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT (part_number, date_code)
        DO UPDATE SET
          current_sequence = EXCLUDED.current_sequence,
          updated_at = CURRENT_TIMESTAMP
      `,
      [PART.part_number, PART.date_code, 50]
    );

    await client.query('COMMIT');
    console.log(`Seeded Madras Engineering sample data. customer_id=${customerId}, part_id=${partId}, report_id=${reportId}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to seed Madras Engineering sample data:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
