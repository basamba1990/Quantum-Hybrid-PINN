'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useRealtime<T>(
  table: string,
  filter?: { column: string; value: string }
) {
  const [data, setData] = useState<T[]>([])
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      let query = supabase.from(table).select('*')
      if (filter) query = query.eq(filter.column, filter.value)
      const { data } = await query
      setData(data || [])
    }

    fetchData()

    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: filter
            ? `${filter.column}=eq.${filter.value}`
            : undefined,
        },
        () => fetchData()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter?.column, filter?.value])

  return data
}