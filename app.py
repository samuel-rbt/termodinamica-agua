from flask import Flask, request, jsonify
from flask_cors import CORS
from CoolProp.CoolProp import PropsSI

app = Flask(__name__)
CORS(app)

def get_water_props(P_pa, T_k=None, Q=None, S_jk=None):
    fluid = 'Water'
    if T_k is not None:
        return {
            'u': PropsSI('U', 'P', P_pa, 'T', T_k, fluid) / 1000,
            'h': PropsSI('H', 'P', P_pa, 'T', T_k, fluid) / 1000,
            's': PropsSI('S', 'P', P_pa, 'T', T_k, fluid) / 1000,
            'v': 1 / PropsSI('D', 'P', P_pa, 'T', T_k, fluid),
            'T': T_k - 273.15
        }
    if Q is not None:
        return {
            'u': PropsSI('U', 'P', P_pa, 'Q', Q, fluid) / 1000,
            'h': PropsSI('H', 'P', P_pa, 'Q', Q, fluid) / 1000,
            's': PropsSI('S', 'P', P_pa, 'Q', Q, fluid) / 1000,
            'v': 1 / PropsSI('D', 'P', P_pa, 'Q', Q, fluid),
            'T': PropsSI('T', 'P', P_pa, 'Q', Q, fluid) - 273.15
        }
    if S_jk is not None:
         return {
            'u': PropsSI('U', 'P', P_pa, 'S', S_jk, fluid) / 1000,
            'h': PropsSI('H', 'P', P_pa, 'S', S_jk, fluid) / 1000,
            'T': PropsSI('T', 'P', P_pa, 'S', S_jk, fluid) - 273.15,
            'v': 1 / PropsSI('D', 'P', P_pa, 'S', S_jk, fluid),
            's': S_jk / 1000
        }

@app.route('/calcular', methods=['POST'])
def calcular():
    data = request.json
    try:
        P_kpa = float(data['P'])
        T_c = float(data['T'])
        P_cond_kpa = 10.0 # Condensador fixo em 10 kPa

        P_pa = P_kpa * 1000
        T_k = T_c + 273.15
        P_cond_pa = P_cond_kpa * 1000

        # --- PONTOS DO CICLO ---
        p1 = get_water_props(P_pa, T_k=T_k) 
        p3 = get_water_props(P_cond_pa, Q=0) 
        p2 = get_water_props(P_cond_pa, S_jk=p1['s']*1000) 
        p4 = get_water_props(P_pa, S_jk=p3['s']*1000) 

        # --- BALANÇO DE ENERGIA (Conforme foto manuscrita) ---
        Wt = p1['h'] - p2['h'] 
        ql = p2['h'] - p3['h'] 
        Wb = p4['h'] - p3['h'] 
        qh = p1['h'] - p4['h'] 
        eta = (Wt - Wb) / qh if qh > 0 else 0 

        # --- ESTADO TERMODINÂMICO ---
        tsat = PropsSI('T', 'P', P_pa, 'Q', 0, 'Water') - 273.15
        if T_c > tsat + 0.1: estado = "VAPOR SUPERAQUECIDO"
        elif T_c < tsat - 0.1: estado = "LÍQUIDO COMPRIMIDO"
        else: estado = "MISTURA SATURADA"
        
        operador = ">" if T_c > tsat + 0.1 else "<" if T_c < tsat - 0.1 else "≈"

        # --- NOVO MEMORIAL DE CÁLCULO ---
        memorial_text = [
            f"[PARÂMETROS DE ENTRADA]",
            f"P_caldeira = {P_kpa} kPa",
            f"T_caldeira = {T_c} °C",
            f"P_condensador = {P_cond_kpa} kPa",
            f"\n[ESTADO TERMODINÂMICO (Ponto 1)]",
            f"Tsat = {tsat:.2f} °C",
            f"T {operador} Tsat ➔ {T_c} {operador} {tsat:.2f} ➔ {estado}",
            f"\n[ENTALPIAS ENCONTRADAS]",
            f"h₁ = {p1['h']:.2f} kJ/kg (P_caldeira, T_caldeira)",
            f"h₂ = {p2['h']:.2f} kJ/kg (P_condensador, s₂=s₁)",
            f"h₃ = {p3['h']:.2f} kJ/kg (P_condensador, Líq. Saturado)",
            f"h₄ = {p4['h']:.2f} kJ/kg (P_caldeira, s₄=s₃)",
            f"\n[FÓRMULAS E BALANÇO DE ENERGIA]",
            f"➤ Trabalho da Turbina (Wt):",
            f"Wt = h₁ - h₂ = {p1['h']:.2f} - {p2['h']:.2f} = {Wt:.2f} kJ/kg",
            f"➤ Calor Rejeitado (ql):",
            f"ql = h₂ - h₃ = {p2['h']:.2f} - {p3['h']:.2f} = {ql:.2f} kJ/kg",
            f"➤ Trabalho da Bomba (Wb):",
            f"Wb = h₄ - h₃ = {p4['h']:.2f} - {p3['h']:.2f} = {Wb:.2f} kJ/kg",
            f"➤ Calor Fornecido (qh):",
            f"qh = h₁ - h₄ = {p1['h']:.2f} - {p4['h']:.2f} = {qh:.2f} kJ/kg",
            f"➤ Rendimento Térmico (η):",
            f"η = (Wt - Wb) / qh = ({Wt:.2f} - {Wb:.2f}) / {qh:.2f} = {(eta*100):.2f}%"
        ]

        tabela = []
        temps = [0.01, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 75, 100, 150, 200, 250, 300, 350, 374.14]
        if 0.01 <= T_c <= 374.14 and T_c not in temps: temps.append(T_c)
        temps = sorted(list(set(temps)))

        for t in temps:
            tk = t + 273.15
            try:
                pk = PropsSI('P', 'T', tk, 'Q', 0, 'Water') / 1000
                vl = 1/PropsSI('D', 'T', tk, 'Q', 0, 'Water')
                vv = 1/PropsSI('D', 'T', tk, 'Q', 1, 'Water')
                ul = PropsSI('U', 'T', tk, 'Q', 0, 'Water')/1000
                uv = PropsSI('U', 'T', tk, 'Q', 1, 'Water')/1000
                hl = PropsSI('H', 'T', tk, 'Q', 0, 'Water')/1000
                hv = PropsSI('H', 'T', tk, 'Q', 1, 'Water')/1000
                sl = PropsSI('S', 'T', tk, 'Q', 0, 'Water')/1000
                sv = PropsSI('S', 'T', tk, 'Q', 1, 'Water')/1000
                tabela.append({"is_user": abs(t - T_c) < 0.0001, "valores": [t, pk, vl, vv, ul, uv-ul, uv, hl, hv-hl, hv, sl, sv-sl, sv]})
            except: pass

        return jsonify({
            'pontos': [p1, p2, p3, p4], 'estado': estado, 'Tsat': tsat, 'tabela': tabela,
            'memorial_list': memorial_text
        })
    except Exception as e:
        return jsonify({'error': 'Erro de cálculo. Valores inválidos.'}), 400

if __name__ == '__main__':
    app.run(debug=True, port=5000)