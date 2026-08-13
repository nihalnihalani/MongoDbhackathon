import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import { StampDistressFilter } from './components/Stamp'
import { Courtroom } from './routes/Courtroom'
import { Dossier } from './routes/Dossier'
import { CaseFile } from './routes/CaseFile'
import { NotFound } from './routes/NotFound'

/**
 * Each route carries its own boundary so a fault in one surface cannot take the
 * live stream down with it.
 */
export function App() {
  return (
    <BrowserRouter>
      <StampDistressFilter />
      <Routes>
        <Route element={<Layout />}>
          <Route
            index
            element={
              <ErrorBoundary surface="Courtroom">
                <Courtroom />
              </ErrorBoundary>
            }
          />
          <Route
            path="contributor/:id"
            element={
              <ErrorBoundary surface="Dossier">
                <Dossier />
              </ErrorBoundary>
            }
          />
          <Route
            path="review/:id"
            element={
              <ErrorBoundary surface="Case file">
                <CaseFile />
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
