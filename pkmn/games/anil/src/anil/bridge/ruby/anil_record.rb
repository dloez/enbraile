module AnilBridge
  RECORD_FILE = __FILE__
  RECORD = "record.jsonl"
  OWNER_BUTTONS = ["DOWN", "LEFT", "RIGHT", "UP", "A", "B", "C", "X", "Y", "Z", "L", "R", "SHIFT", "CTRL", "ALT", "F5", "F6", "F7", "F8", "F9"]
  KEY_QUERIES = [:press_key, :trigger_key, :repeat_key]
  DIGEST_DEPTH = 8
  BRIDGE_KINDS = ["advance", "input", "eval", "control", "speed", "snapshot", "restore", "event", "rules_bought", "rules_shiny"]
  NOTE_KIND = /\A[a-z][a-z_]*\z/

  @record = nil
  @owner_keys = []
  @owner_text = ""

  def self.record(kind, fields)
    return unless @launch["session_dir"]
    entry = { "tick" => @tick, "kind" => kind }
    fields.each { |name, value| entry[name] = value }
    @record ||= File.open(session_path(RECORD), "a")
    @record.puts(AnilJSON.encode(entry))
    @record.flush
  rescue Exception => error
    log_exception("record #{kind}", error)
  end

  def self.note(client, request)
    kind = request["kind"]
    entry = request["entry"] || {}
    raise ArgumentError, "note needs a kind of lowercase letters and underscores" unless kind.is_a?(String) && kind =~ NOTE_KIND
    raise ArgumentError, "note cannot write #{kind} entries, which the bridge writes itself" if BRIDGE_KINDS.include?(kind)
    raise ArgumentError, "note needs an entry object" unless entry.is_a?(Hash)
    raise ArgumentError, "a note entry cannot set tick, kind or client" if entry.key?("tick") || entry.key?("kind") || entry.key?("client")
    recorded = !@launch["session_dir"].nil?
    record(kind, { "client" => client[:name] }.merge(entry))
    { "recorded" => recorded }
  end

  def self.observe_input(query, args, result)
    if result && KEY_QUERIES.include?(query)
      key = args[0].is_a?(Symbol) ? args[0].to_s : args[0]
      @owner_keys << key unless @owner_keys.include?(key)
    elsif query == :gets && result.is_a?(String)
      @owner_text << result
    end
    result
  end

  def self.record_owner_input
    return if driven? || !Input.respond_to?(:anil_bridge_press)
    buttons = OWNER_BUTTONS.select { |name| Input.const_defined?(name) && Input.anil_bridge_press(Input.const_get(name)) }
    keys = @owner_keys
    text = @owner_text
    @owner_keys = []
    @owner_text = ""
    return if buttons.empty? && keys.empty? && text.empty?
    record("input", "buttons" => buttons, "keys" => keys, "text" => text)
  rescue Exception => error
    log_exception("owner input", error)
  end

  def self.digest
    party = $player ? $player.party : nil
    {
      "party" => party.nil? ? nil : Zlib.crc32(canonical(party, DIGEST_DEPTH)),
      "position" => position,
      "rng" => @rng_calls
    }
  rescue Exception => error
    log_exception("digest", error)
    { "error" => "#{error.class}: #{error.message}", "rng" => @rng_calls }
  end

  def self.canonical(value, depth)
    case value
    when nil, true, false, Numeric, String, Symbol then value.inspect
    when Array then depth > 0 ? "[#{value.map { |item| canonical(item, depth - 1) }.join(',')}]" : "[...]"
    when Hash
      return "{...}" if depth <= 0
      pairs = value.map { |key, item| "#{canonical(key, depth - 1)}=>#{canonical(item, depth - 1)}" }
      "{#{pairs.sort.join(',')}}"
    else
      return "#{value.class.name}(...)" if depth <= 0
      ivars = value.instance_variables.map { |name| name.to_s }.sort
      "#{value.class.name}(#{ivars.map { |name| "#{name}=#{canonical(value.instance_variable_get(name), depth - 1)}" }.join(',')})"
    end
  end
end
