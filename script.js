Chart.register(ChartDataLabels);

document.getElementById('csvFile').addEventListener('change', function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const content = e.target.result.replace(/^\uFEFF/, '');

    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        const dataOriginal = results.data;

        const expectedHeaders = [
          'FUENTE DE FINANCIAMIENTO', 'PROYECTO', 'CAPITULO', 'PARTIDA', 'DIVISION',
          'DEPARTAMENTO', 'DESCRIPCION', 'INICIAL', 'ADECUACIONES', 'TRANSFERENCIAS',
          'MODIFICADO', 'PRECOMPROMETIDO', 'COMPROMISO', 'GASTO', 'DISPONIBLE'
        ];
        const actualHeaders = Object.keys(dataOriginal[0] || {});
        const missingHeaders = expectedHeaders.filter(h => !actualHeaders.includes(h));
        if (missingHeaders.length > 0) {
          alert('🚫 Faltan estos encabezados:\n\n' + missingHeaders.join('\n'));
          return;
        }

        const fuenteSet = new Set();
        const divisionSet = new Set();
        const departamentosPorDivision = {};

        dataOriginal.forEach(row => {
          const fuente = row['FUENTE DE FINANCIAMIENTO']?.trim();
          const division = row['DIVISION']?.trim();
          const departamento = row['DEPARTAMENTO']?.trim();

          if (fuente) fuenteSet.add(fuente);
          if (division) divisionSet.add(division);
          if (division && departamento) {
            if (!departamentosPorDivision[division]) {
              departamentosPorDivision[division] = new Set();
            }
            departamentosPorDivision[division].add(departamento);
          }
        });

        const fuenteSelect = document.getElementById('filtroFuente');
        const divisionSelect = document.getElementById('filtroDivision');
        const departamentoSelect = document.getElementById('filtroDepartamento');

        fuenteSelect.innerHTML = '<option value="">Todas las fuentes</option>';
        divisionSelect.innerHTML = '<option value="">Todas las divisiones</option>';
        departamentoSelect.innerHTML = '<option value="">Todos los departamentos</option>';

        [...fuenteSet].sort().forEach(f => {
          const opt = document.createElement('option');
          opt.value = f;
          opt.textContent = f;
          fuenteSelect.appendChild(opt);
        });

        [...divisionSet].sort().forEach(d => {
          const opt = document.createElement('option');
          opt.value = d;
          opt.textContent = d;
          divisionSelect.appendChild(opt);
        });

        const actualizarVista = () => {
          const filtroFuente = fuenteSelect.value;
          const filtroDivision = divisionSelect.value;
          const filtroDepartamento = departamentoSelect.value;

          const datosFiltrados = dataOriginal.filter(row => {
            const fuente = row['FUENTE DE FINANCIAMIENTO']?.trim();
            const division = row['DIVISION']?.trim();
            const departamento = row['DEPARTAMENTO']?.trim();
            if (filtroFuente && fuente !== filtroFuente) return false;
            if (filtroDivision && division !== filtroDivision) return false;
            if (filtroDepartamento && departamento !== filtroDepartamento) return false;
            return true;
          });

          let totalModificado = 0;
          let totalEjercido = 0;
          let totalDisponible = 0;
          const agrupados = {};

          datosFiltrados.forEach(row => {
            const grupo = row['CAPITULO']?.trim() || 'Sin valor';
            const modificado = parseFloat(row['MODIFICADO']?.replace(/[$,"]/g, '') || 0);
            const ejercido = parseFloat(row['GASTO']?.replace(/[$,"]/g, '') || 0);

            totalModificado += modificado;
            totalEjercido += ejercido;
            totalDisponible += modificado - ejercido;

            if (!agrupados[grupo]) {
              agrupados[grupo] = { ejercido: 0, disponible: 0, total: 0 };
            }
            agrupados[grupo].ejercido += ejercido;
            agrupados[grupo].disponible += modificado - ejercido;
            agrupados[grupo].total += modificado;
          });

          const agrupadosOrdenables = Object.keys(agrupados).map(k => ({
            capitulo: k,
            ...agrupados[k]
          })).sort((a, b) => b.total - a.total);

          const etiquetas = agrupadosOrdenables.map(obj => obj.capitulo);
          const datosEjercido = agrupadosOrdenables.map(obj => obj.ejercido);
          const datosDisponible = agrupadosOrdenables.map(obj => obj.disponible);
          const datosPorcentajeEjercido = agrupadosOrdenables.map(obj =>
            obj.total > 0 ? (obj.ejercido / obj.total) * 100 : 0
          );
          const datosPorcentajeDisponible = datosPorcentajeEjercido.map(p => 100 - p);

          // Tarjetas: dos columnas, tres filas
          const cardsContainer = document.getElementById('cardsContainer');
          cardsContainer.innerHTML = ''; // Limpia antes de agregar nuevas tarjetas

          // Modificado/Inicial: sin decimales, los demás con 1 decimal
          const crearTarjeta = (etiqueta, valor, color, esPorcentaje = false) => {
            const div = document.createElement('div');
            div.className = `card${color ? ' ' + color : ''}`;
            if (esPorcentaje && (etiqueta === 'MODIFICADO (%)' || etiqueta === 'INICIAL (%)')) {
              div.textContent = `${etiqueta}: ${Math.round(valor)}%`;
            } else if (esPorcentaje) {
              div.textContent = `${etiqueta}: ${valor.toFixed(1)}%`;
            } else {
              div.textContent = `${etiqueta}: $${valor.toLocaleString('es-MX')}`;
            }
            return div;
          };

          const porcentajeModificado = 100;
          const porcentajeEjercido = totalModificado > 0 ? (totalEjercido / totalModificado) * 100 : 0;
          const porcentajeDisponible = totalModificado > 0 ? (totalDisponible / totalModificado) * 100 : 0;

          // Crea la tabla de tarjetas (dos columnas, tres filas)
          const tabla = document.createElement('div');
          tabla.className = 'tabla-tarjetas-dos-columnas';

          // Columna 1: valores absolutos
          const columnaAbs = document.createElement('div');
          columnaAbs.className = 'columna-tarjetas';
          columnaAbs.appendChild(crearTarjeta('INICIAL', totalModificado));
          columnaAbs.appendChild(crearTarjeta('EJERCIDO', totalEjercido, 'blue'));
          columnaAbs.appendChild(crearTarjeta('DISPONIBLE', totalDisponible, 'yellow'));

          // Columna 2: porcentajes
          const columnaPorc = document.createElement('div');
          columnaPorc.className = 'columna-tarjetas';
          columnaPorc.appendChild(crearTarjeta('INICIAL (%)', porcentajeModificado, '', true));
          columnaPorc.appendChild(crearTarjeta('EJERCIDO (%)', porcentajeEjercido, 'blue', true));
          columnaPorc.appendChild(crearTarjeta('DISPONIBLE (%)', porcentajeDisponible, 'yellow', true));

          // Agrega ambas columnas a la tabla
          tabla.appendChild(columnaAbs);
          tabla.appendChild(columnaPorc);

          // Agrega la tabla al contenedor principal
          cardsContainer.appendChild(tabla);

          // 📊 Gráfico vertical (sección 2)
          const ctx = document.getElementById('stackedChart').getContext('2d');
          if (window.graficoCapitulo) window.graficoCapitulo.destroy();
          window.graficoCapitulo = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: etiquetas,
              datasets: [
                {
                  label: 'Ejercido (GASTO)',
                  data: datosEjercido,
                  backgroundColor: 'rgb(173, 37, 168)'
                },
                {
                  label: 'Disponible restante',
                  data: datosDisponible,
                  backgroundColor: 'rgb(191, 191, 191)'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: 'Ejercicio presupuestal por capítulo (valores absolutos)'
                },
                tooltip: {
                  callbacks: {
                    label: ctx => {
                      const valor = ctx.parsed.y || 0;
                      return `${ctx.dataset.label}: $${valor.toLocaleString('es-MX')}`;
                    }
                  }
                },
                legend: {
                  position: 'bottom'
                },
                datalabels: {
                  display: ctx => ctx.datasetIndex === 1,
                  anchor: 'end',
                  align: 'top',
                  formatter: (value, ctx) => {
                    const ejercido = ctx.chart.data.datasets[0].data[ctx.dataIndex];
                    const total = ejercido + value;
                    return `$${total.toLocaleString('es-MX')}`;
                  },
                  font: { size: 10, weight: 'normal' },
                  color: '#333'
                }
              },
              scales: {
                x: { stacked: true, title: { display: true, text: 'Capítulo' } },
                y: {
                  stacked: true,
                  title: { display: true, text: 'Monto en pesos mexicanos' },
                  ticks: {
                    callback: value => `$${value.toLocaleString('es-MX')}`
                  }
                }
              }
            },
            plugins: [ChartDataLabels]
          });

          // 📊 Gráfico horizontal en porcentajes (sección 4)
          const ctxH = document.getElementById('horizontalChart').getContext('2d');
          if (window.graficoHorizontal) window.graficoHorizontal.destroy();
          window.graficoHorizontal = new Chart(ctxH, {
            type: 'bar',
            data: {
              labels: etiquetas,
              datasets: [
                {
                  label: 'Ejercido (%)',
                  data: datosPorcentajeEjercido,
                  backgroundColor: 'rgb(173, 37, 168)'
                },
                {
                  label: 'Restante (%)',
                  data: datosPorcentajeDisponible,
                  backgroundColor: 'rgb(191, 191, 191)'
                }
              ]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                title: {
                  display: true,
                  text: 'Ejercicio presupuestal por capítulo (valores porcentuales)'
                },
                tooltip: {
                  callbacks: {
                    label: ctx => `${ctx.dataset.label}: ${ctx.parsed.x.toFixed(1)}%`
                  }
                },
                legend: {
                  position: 'bottom'
                },
                datalabels: {
                  anchor: 'centered',
                  align: 'centered',
                  formatter: value => `${value.toFixed(1)}%`,
                  font: {
                    size: 10,
                    weight: 'normal'
                  },
                  color: '#333'
                }
              },
              scales: {
                x: {
                  stacked: true,
                  max: 100,
                  title: {
                    display: true,
                    text: 'Porcentaje (%)'
                  },
                  ticks: {
                    callback: val => `${val}%`
                  }
                },
                y: {
                  stacked: true,
                  title: {
                    display: true,
                    text: 'Capítulo'
                  }
                }
              }
            },
            plugins: [ChartDataLabels]
          });
        };

        // 📌 Reactividad de filtros
        fuenteSelect.addEventListener('change', actualizarVista);

        divisionSelect.addEventListener('change', () => {
          const seleccion = divisionSelect.value;
          departamentoSelect.innerHTML = '<option value="">Todos los departamentos</option>';
          if (seleccion && departamentosPorDivision[seleccion]) {
            [...departamentosPorDivision[seleccion]].sort().forEach(dep => {
              const opt = document.createElement('option');
              opt.value = dep;
              opt.textContent = dep;
              departamentoSelect.appendChild(opt);
            });
          }
          // Solo llamamos actualizarVista una vez, fuera del ciclo
          actualizarVista();
        });

        departamentoSelect.addEventListener('change', actualizarVista);

        actualizarVista(); // ✅ Ejecuta la vista al cargar
      }
    });
  };

  reader.readAsText(file, 'UTF-8'); // ✅ Lectura del archivo CSV
});