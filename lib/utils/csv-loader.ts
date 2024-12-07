import fs from 'fs'
import path from 'path'
import { parse } from 'papaparse'

export function loadCsvData() {
	// Read CSV file from your project
	const csvPath = path.join(process.cwd(), 'data', 'astro_data.csv')
	const csvContent = fs.readFileSync(csvPath, 'utf-8')

	// Parse CSV
	const parsedData = parse(csvContent, {
		header: true,
		skipEmptyLines: true,
	})

	return parsedData.data
}
