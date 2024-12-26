script_header = []
script_header.append("------------------------Context Free Script------------------------------------------")
script_header.append("--Parameters: @print: PRINT english description of what the script is doing")
script_header.append("--            @printExec: PRINT the SQL statements the script generates")
script_header.append("--            @execCode: EXECUTE the script on the database")
script_header.append("")
script_header.append("--feel free to change these flags")
script_header.append(f"DECLARE {m_sVarLang_VariablePrefix}print {m_sVarlang_BooleanType} {m_sVarLang_SetOperator} 1{m_sVarLang_DeclareSeparator} ")
script_header.append(f"\t{m_sVarLang_VariablePrefix}printExec {m_sVarlang_BooleanType} {m_sVarLang_SetOperator} 1{m_sVarLang_DeclareSeparator} ")
script_header.append(f"\t{m_sVarLang_VariablePrefix}execCode {m_sVarlang_BooleanType} {m_sVarLang_SetOperator} 1;")
script_header.append("-------------------------------------------------------------------------------------")
script_header.append("")

# Join lines if needed:
script_header_text = "\n".join(script_header)