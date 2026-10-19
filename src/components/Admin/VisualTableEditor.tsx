import React, { useState, useEffect, useRef } from 'react';
import { TableData, TableRow, TableCell } from '../../types';
import { Plus, Trash2, Columns, Rows, Table, Check, Sparkles, Undo2, Redo2 } from 'lucide-react';

interface VisualTableEditorProps {
  initialData?: TableData;
  questionId: string;
  onChange: (data: TableData) => void;
}

export const VisualTableEditor: React.FC<VisualTableEditorProps> = ({
  initialData,
  questionId,
  onChange
}) => {
  const [title, setTitle] = useState<string>(initialData?.title || 'Summary Table');
  const [headers, setHeaders] = useState<string[]>(
    initialData?.headers && initialData.headers.length > 0
      ? initialData.headers
      : ['Category / Aspect', 'Historical Period', 'Key Findings']
  );
  const [rows, setRows] = useState<TableRow[]>(
    initialData?.rows && initialData.rows.length > 0
      ? initialData.rows
      : [
          {
            cells: [
              { text: 'Solar Thermal', is_blank: false },
              { text: '19th Century', is_blank: false },
              { text: '', is_blank: true, question_id: questionId, placeholder: 'Enter discovery...' }
            ]
          },
          {
            cells: [
              { text: 'Photovoltaic', is_blank: false },
              { text: '1954', is_blank: false },
              { text: 'Bell Laboratories', is_blank: false }
            ]
          }
        ]
  );

  // History Stack for Undo/Redo
  const [history, setHistory] = useState<Array<{ title: string; headers: string[]; rows: TableRow[] }>>(() => [
    {
      title: initialData?.title || 'Summary Table',
      headers: initialData?.headers || ['Category / Aspect', 'Historical Period', 'Key Findings'],
      rows: initialData?.rows || [
        {
          cells: [
            { text: 'Solar Thermal', is_blank: false },
            { text: '19th Century', is_blank: false },
            { text: '', is_blank: true, question_id: questionId, placeholder: 'Enter discovery...' }
          ]
        },
        {
          cells: [
            { text: 'Photovoltaic', is_blank: false },
            { text: '1954', is_blank: false },
            { text: 'Bell Laboratories', is_blank: false }
          ]
        }
      ]
    }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = (newTitle: string, newHeaders: string[], newRows: TableRow[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push({
      title: newTitle,
      headers: JSON.parse(JSON.stringify(newHeaders)),
      rows: JSON.parse(JSON.stringify(newRows))
    });
    // Keep max 30 snapshots
    if (nextHistory.length > 30) nextHistory.shift();
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setTitle(prev.title);
      setHeaders(prev.headers);
      setRows(prev.rows);
      setHistoryIndex(historyIndex - 1);
      onChange({
        title: prev.title,
        headers: prev.headers,
        rows: prev.rows
      });
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setTitle(next.title);
      setHeaders(next.headers);
      setRows(next.rows);
      setHistoryIndex(historyIndex + 1);
      onChange({
        title: next.title,
        headers: next.headers,
        rows: next.rows
      });
    }
  };

  // Keyboard shortcut Ctrl+Z / Cmd+Z / Ctrl+Y
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  const notifyChange = (newTitle: string, newHeaders: string[], newRows: TableRow[]) => {
    pushHistory(newTitle, newHeaders, newRows);
    onChange({
      title: newTitle,
      headers: newHeaders,
      rows: newRows
    });
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    notifyChange(val, headers, rows);
  };

  const handleHeaderChange = (index: number, val: string) => {
    const updated = [...headers];
    updated[index] = val;
    setHeaders(updated);
    notifyChange(title, updated, rows);
  };

  const handleAddColumn = () => {
    const newHeaders = [...headers, `Column ${headers.length + 1}`];
    const newRows = rows.map(r => ({
      cells: [...r.cells, { text: '', is_blank: false }]
    }));
    setHeaders(newHeaders);
    setRows(newRows);
    notifyChange(title, newHeaders, newRows);
  };

  const handleRemoveColumn = (colIdx: number) => {
    if (headers.length <= 1) return;
    const newHeaders = headers.filter((_, idx) => idx !== colIdx);
    const newRows = rows.map(r => ({
      cells: r.cells.filter((_, idx) => idx !== colIdx)
    }));
    setHeaders(newHeaders);
    setRows(newRows);
    notifyChange(title, newHeaders, newRows);
  };

  const handleAddRow = () => {
    const newRow: TableRow = {
      cells: headers.map(() => ({ text: '', is_blank: false }))
    };
    const newRows = [...rows, newRow];
    setRows(newRows);
    notifyChange(title, headers, newRows);
  };

  const handleRemoveRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    const newRows = rows.filter((_, idx) => idx !== rowIdx);
    setRows(newRows);
    notifyChange(title, headers, newRows);
  };

  const handleCellTextChange = (rowIdx: number, colIdx: number, val: string) => {
    const newRows = rows.map((r, rI) => {
      if (rI !== rowIdx) return r;
      const newCells = r.cells.map((c, cI) => {
        if (cI !== colIdx) return c;
        return { ...c, text: val };
      });
      return { ...r, cells: newCells };
    });
    setRows(newRows);
    notifyChange(title, headers, newRows);
  };

  const handleToggleBlank = (rowIdx: number, colIdx: number) => {
    const newRows = rows.map((r, rI) => {
      if (rI !== rowIdx) return r;
      const newCells = r.cells.map((c, cI) => {
        if (cI !== colIdx) return c;
        const willBeBlank = !c.is_blank;
        const qNum = parseInt(questionId.replace(/\D/g, ''), 10) || (rI + 1);
        return {
          ...c,
          is_blank: willBeBlank,
          text: willBeBlank ? `[blank_${qNum}]` : (c.text?.startsWith('[blank_') ? '' : c.text),
          question_id: willBeBlank ? (c.question_id || questionId) : undefined,
          placeholder: willBeBlank ? `[blank_${qNum}] Candidate enters answer...` : undefined
        };
      });
      return { ...r, cells: newCells };
    });
    setRows(newRows);
    notifyChange(title, headers, newRows);
  };

  const handleApplyPreset = (type: 'timeline' | 'comparison' | 'process') => {
    if (type === 'timeline') {
      const pHeaders = ['Time Period', 'Key Innovator', 'Technology Developed'];
      const pRows: TableRow[] = [
        { cells: [{ text: '1839', is_blank: false }, { text: 'Edmond Becquerel', is_blank: false }, { text: '', is_blank: true, question_id: questionId }] },
        { cells: [{ text: '1883', is_blank: false }, { text: 'Charles Fritts', is_blank: false }, { text: 'First selenium cell', is_blank: false }] },
        { cells: [{ text: '1954', is_blank: false }, { text: 'Bell Labs', is_blank: false }, { text: 'Silicon solar cell', is_blank: false }] }
      ];
      setTitle('Chronological Timeline of Inventions');
      setHeaders(pHeaders);
      setRows(pRows);
      notifyChange('Chronological Timeline of Inventions', pHeaders, pRows);
    } else if (type === 'comparison') {
      const pHeaders = ['Method / System', 'Key Features', 'Limitations'];
      const pRows: TableRow[] = [
        { cells: [{ text: 'Active Solar', is_blank: false }, { text: 'Mechanical pump & fans', is_blank: false }, { text: 'Higher upfront cost', is_blank: false }] },
        { cells: [{ text: 'Passive Solar', is_blank: false }, { text: '', is_blank: true, question_id: questionId }, { text: 'Weather dependent', is_blank: false }] }
      ];
      setTitle('Comparative Analysis');
      setHeaders(pHeaders);
      setRows(pRows);
      notifyChange('Comparative Analysis', pHeaders, pRows);
    }
  };

  return (
    <div className="p-4 bg-white rounded-2xl border border-purple-200 shadow-sm space-y-4">
      {/* Top Header & Presets */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-purple-100 text-[#6B51A5] rounded-xl">
            <Table className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-[#3C2A63]">Table Completion Builder</h4>
            <p className="text-[11px] text-[#7C68A5]">Create columns, rows, and mark question blanks</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Undo / Redo controls */}
          <div className="flex items-center bg-[#FAF8FE] border border-purple-200 rounded-lg p-0.5 mr-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="px-2 py-1 text-[10px] font-bold text-[#503A7A] hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed rounded flex items-center gap-1 transition cursor-pointer"
              title="Undo last change (Ctrl+Z)"
            >
              <Undo2 className="w-3 h-3 text-[#6B51A5]" />
              <span>Undo</span>
            </button>
            <div className="w-px h-3 bg-purple-200" />
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="px-2 py-1 text-[10px] font-bold text-[#503A7A] hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed rounded flex items-center gap-1 transition cursor-pointer"
              title="Redo change (Ctrl+Y)"
            >
              <Redo2 className="w-3 h-3 text-[#6B51A5]" />
              <span>Redo</span>
            </button>
          </div>

          <span className="text-[10px] font-bold text-[#7C68A5] flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#6B51A5]" />
            Presets:
          </span>
          <button
            type="button"
            onClick={() => handleApplyPreset('timeline')}
            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-[#503A7A] rounded-lg text-[10px] font-bold transition cursor-pointer"
          >
            Timeline Table
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('comparison')}
            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 text-[#503A7A] rounded-lg text-[10px] font-bold transition cursor-pointer"
          >
            Comparison Table
          </button>
        </div>
      </div>

      {/* Table Title Input */}
      <div>
        <label className="block text-[11px] font-black text-[#503A7A] mb-1">
          Table Title / Heading:
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="e.g. Table: Summary of Renewable Developments"
          className="w-full px-3 py-1.5 bg-[#F8F6FC] rounded-xl border border-purple-200 text-xs font-bold text-[#3C2A63] focus:outline-none focus:ring-2 focus:ring-[#6B51A5]"
        />
      </div>

      {/* Editable Table Structure */}
      <div className="overflow-x-auto border border-purple-200 rounded-xl">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-purple-50 border-b border-purple-200">
              {headers.map((h, colIdx) => (
                <th key={colIdx} className="p-2 border-r border-purple-200 last:border-r-0 min-w-[140px]">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={h}
                      onChange={(e) => handleHeaderChange(colIdx, e.target.value)}
                      placeholder={`Column ${colIdx + 1}`}
                      className="w-full px-2 py-1 bg-white rounded-lg border border-purple-200 text-xs font-black text-[#3C2A63] focus:outline-none focus:ring-1 focus:ring-[#6B51A5]"
                    />
                    {headers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(colIdx)}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer shrink-0"
                        title="Delete Column"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-purple-100">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-[#FAF8FD]'}>
                {row.cells.map((cell, cIdx) => (
                  <td key={cIdx} className="p-2 border-r border-purple-100 last:border-r-0 align-top">
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={cell.text || ''}
                        disabled={cell.is_blank}
                        onChange={(e) => handleCellTextChange(rIdx, cIdx, e.target.value)}
                        placeholder={cell.is_blank ? `[BLANK FOR CANDIDATE: ${cell.question_id || questionId}]` : "Enter cell text..."}
                        className={`w-full px-2 py-1 rounded-lg border text-xs font-medium transition ${
                          cell.is_blank
                            ? 'bg-purple-100/90 border-[#6B51A5] text-[#503A7A] font-black placeholder-[#503A7A]'
                            : 'bg-white border-purple-200 text-[#3C2A63] focus:outline-none focus:ring-1 focus:ring-[#6B51A5]'
                        }`}
                      />
                      
                      <div className="flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => handleToggleBlank(rIdx, cIdx)}
                          className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition flex items-center gap-1 cursor-pointer ${
                            cell.is_blank
                              ? 'bg-[#6B51A5] text-white shadow-xs'
                              : 'bg-purple-50 text-[#6B51A5] hover:bg-purple-100'
                          }`}
                          title="Click hoặc bấm chuột phải vào ô để chuyển thành ô điền đáp án [blank]"
                        >
                          <Check className="w-3 h-3" />
                          <span>{cell.is_blank ? 'Ô Điền Đáp Án [blank] (Active)' : 'Chuyển thành ô điền đáp án'}</span>
                        </button>

                        {cIdx === row.cells.length - 1 && rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(rIdx)}
                            className="text-rose-400 hover:text-rose-600 p-0.5 cursor-pointer"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Action Controls */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="px-3 py-1.5 bg-[#FAF4F8] hover:bg-[#F3EFF9] text-[#503A7A] border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#6B51A5]" />
            <span>Add Row</span>
          </button>

          <button
            type="button"
            onClick={handleAddColumn}
            className="px-3 py-1.5 bg-[#FAF4F8] hover:bg-[#F3EFF9] text-[#503A7A] border border-purple-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <Columns className="w-3.5 h-3.5 text-[#6B51A5]" />
            <span>Add Column</span>
          </button>
        </div>

        <span className="text-[11px] text-[#7C68A5] font-semibold">
          {rows.length} rows × {headers.length} columns
        </span>
      </div>
    </div>
  );
};
