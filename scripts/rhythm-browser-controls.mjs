/** Select a pending length through the learner's customization dialog. */
export async function selectExerciseLength(page, value) {
  await page.getByRole('button', { name: 'Customize…', exact: true }).click();
  await page.locator(`[data-setting="exercise-length"] input[value="${value}"]`).check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
}
