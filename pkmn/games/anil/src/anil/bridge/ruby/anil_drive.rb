module AnilBridge
  DRIVE_FILE = __FILE__
  DRIVER_ROLE = "driver"
  CONTROL_ROLE = "control"
  ROLES = [DRIVER_ROLE, CONTROL_ROLE]
  STOP_CONDITIONS = ["signature", "payloads", "position", "moving"]
  REPEAT_START = 15
  REPEAT_INTERVAL = 4
  DIRECTIONS = [2, 4, 6, 8]
  DIAGONALS = { [2, 4] => 1, [2, 6] => 3, [4, 8] => 7, [6, 8] => 9 }
  BUTTON_NAME = /\A[A-Z][A-Za-z0-9]*\z/
  EMPTY_INPUT = { :buttons => [], :keys => [], :text => "" }
  INPUT_WRAPPERS = [
    ["press?", :press], ["trigger?", :trigger], ["repeat?", :repeat], ["release?", :release],
    ["pressex?", :press_key], ["triggerex?", :trigger_key], ["repeatex?", :repeat_key], ["releaseex?", :release_key],
    ["dir4", :dir4], ["dir8", :dir8], ["gets", :gets]
  ]
  STAMP_EPOCH = Time.utc(2026, 1, 1, 12).to_i

  @driver = nil
  @owner_control = false
  @advance = nil
  @frame_offset = 0
  @held = {}
  @released = []
  @keys_held = {}
  @keys_released = []
  @text = ""
  @input_updates = 0

  def self.driven?
    !@driver.nil? && !@owner_control
  end

  def self.held?(client)
    client[:waiting] || (client.equal?(@driver) && (@owner_control || !@advance.nil?))
  end

  def self.claim_role(client, role)
    raise ArgumentError, "unknown role #{role.inspect}" unless role.nil? || ROLES.include?(role)
    if role == DRIVER_ROLE
      raise ArgumentError, "client #{@driver[:sock]} already drives this session" if @driver
      was_driven = driven?
      @driver = client
      end_boot_hold
      clear_input
      log("client #{client[:sock]} drives")
      control_changed(was_driven)
    end
    client[:role] = role
  end

  def self.release_role(client)
    return unless client.equal?(@driver)
    was_driven = driven?
    @driver = nil
    @advance = nil
    clear_input
    log("driver detached; the owner controls")
    control_changed(was_driven)
  end

  def self.control(client, request)
    raise ArgumentError, "control needs a client with the control role" unless client[:role] == CONTROL_ROLE
    case request["action"]
    when "take" then take_control
    when "release" then release_control
    else raise ArgumentError, "control action must be take or release, not #{request['action'].inspect}"
    end
    { "owner" => @owner_control, "driver" => !@driver.nil? }
  end

  def self.take_control
    return if @owner_control
    was_driven = driven?
    @owner_control = true
    end_boot_hold
    clear_input
    log("the owner takes control")
    finish_advance("control") if @advance
    control_changed(was_driven)
  end

  def self.release_control
    return unless @owner_control
    was_driven = driven?
    @owner_control = false
    clear_input
    log("the owner releases control")
    control_changed(was_driven)
  end

  def self.clear_input
    @held = {}
    @released = []
    @keys_held = {}
    @keys_released = []
    @text = ""
  end

  def self.start_advance(client, request)
    raise ArgumentError, "only the driver can advance" unless client.equal?(@driver)
    raise ArgumentError, "a snapshot restore is running" if restoring?
    limit = request["ticks"]
    raise ArgumentError, "advance needs ticks, a positive tick limit" unless limit.is_a?(Integer) && limit > 0
    entries = request["inputs"] || []
    raise ArgumentError, "inputs must be a list" unless entries.is_a?(Array)
    inputs = entries.map { |entry| tick_input(entry) }
    repeat = request["repeat"] == true
    raise ArgumentError, "repeat needs at least one input" if repeat && inputs.empty?
    conditions = request["until"] || []
    unless conditions.is_a?(Array) && conditions.all? { |name| STOP_CONDITIONS.include?(name) }
      raise ArgumentError, "until must be a list of #{STOP_CONDITIONS.join(', ')}"
    end
    start = {}
    conditions.each { |name| start[name] = condition_value(name) }
    @advance = {
      :client => client, :request => request, :limit => limit, :inputs => inputs,
      :repeat => repeat, :until => conditions, :start => start, :ran => 0, :started => @tick
    }
    latch_input(advance_input(@advance))
  end

  def self.tick_input(entry)
    raise ArgumentError, "a tick input must be an object" unless entry.is_a?(Hash)
    buttons = (entry["buttons"] || []).map { |name| button_id(name) }
    keys = (entry["keys"] || []).map { |key| key_id(key) }
    text = entry["text"] || ""
    raise ArgumentError, "text must be a string" unless text.is_a?(String)
    { :buttons => buttons.uniq, :keys => keys.uniq, :text => text }
  end

  def self.button_id(name)
    unless name.is_a?(String) && name =~ BUTTON_NAME && Input.const_defined?(name)
      raise ArgumentError, "unknown button #{name.inspect}"
    end
    Input.const_get(name)
  end

  def self.key_id(key)
    return key if key.is_a?(Integer)
    return key.to_sym if key.is_a?(String) && !key.empty?
    raise ArgumentError, "a key is a virtual-key code or a key name, not #{key.inspect}"
  end

  def self.advance_input(advance)
    inputs = advance[:inputs]
    return EMPTY_INPUT if inputs.empty?
    return inputs[advance[:ran] % inputs.size] if advance[:repeat]
    inputs[advance[:ran]] || EMPTY_INPUT
  end

  def self.step_advance
    advance = @advance
    return if advance.nil?
    advance[:ran] += 1
    reason = advance[:until].find { |name| condition_value(name) != advance[:start][name] }
    reason ||= "ticks" if advance[:ran] >= advance[:limit]
    if reason
      finish_advance(reason)
    else
      latch_input(advance_input(advance))
    end
  end

  def self.finish_advance(reason)
    advance = @advance
    @advance = nil
    result = {
      "ticks" => advance[:ran],
      "stopped" => reason,
      "position" => position,
      "moving" => moving,
      "signature" => @signature
    }
    log("client #{advance[:client][:sock]} advance id=#{advance[:request]['id'].inspect} ran #{advance[:ran]} ticks, stopped on #{reason}")
    answer = reply(advance[:request], true, result, nil)
    request = advance[:request]
    record("advance", {
      "tick" => advance[:started], "end" => @tick, "client" => advance[:client][:name], "id" => request["id"],
      "ticks" => advance[:limit], "inputs" => request["inputs"] || [], "repeat" => advance[:repeat],
      "until" => advance[:until], "ran" => advance[:ran], "stopped" => reason, "digest" => answer["digest"]
    })
    send_line(advance[:client], AnilJSON.encode(answer) + "\n")
  end

  def self.condition_value(name)
    case name
    when "signature" then @signature
    when "payloads" then @payloads.map { |payload| payload.object_id }
    when "position" then position
    when "moving" then moving
    end
  end

  def self.position
    return nil unless $game_map && $game_player
    [$game_map.map_id, $game_player.x, $game_player.y]
  end

  def self.moving
    $game_player ? $game_player.moving? : nil
  end

  def self.waiting_for_driver?
    holding? && @advance.nil? && @restore.nil?
  end

  def self.wait_for_driver
    while waiting_for_driver? || pause_gate?
      render_due? ? Graphics.anil_bridge_update : idle
      sync_frame_count
      accept_clients
      @clients.dup.each { |client| serve(client) }
    end
    end_step
  end

  def self.latch_input(input)
    @released = @held.keys.reject { |id| input[:buttons].include?(id) }
    @held = count_holds(@held, input[:buttons])
    @keys_released = @keys_held.keys.reject { |id| input[:keys].include?(id) }
    @keys_held = count_holds(@keys_held, input[:keys])
    @text = input[:text]
    @input_updates = 0
  end

  def self.input_updated
    @input_updates += 1
  end

  def self.fresh_sample?
    @input_updates < 2
  end

  def self.count_holds(held, pressed)
    counts = {}
    pressed.each { |id| counts[id] = (held[id] || 0) + 1 }
    counts
  end

  def self.repeated?(count)
    count == 1 || (count >= REPEAT_START && (count - REPEAT_START) % REPEAT_INTERVAL == 0)
  end

  def self.button_arg(button)
    return button unless button.is_a?(Symbol)
    Input.const_defined?(button) ? Input.const_get(button) : button
  end

  def self.input_query(query, args)
    case query
    when :press then (@held[button_arg(args[0])] || 0) >= 1
    when :trigger then fresh_sample? && @held[button_arg(args[0])] == 1
    when :repeat then fresh_sample? && repeated?(@held[button_arg(args[0])] || 0)
    when :release then fresh_sample? && @released.include?(button_arg(args[0]))
    when :press_key then (@keys_held[args[0]] || 0) >= 1
    when :trigger_key then fresh_sample? && @keys_held[args[0]] == 1
    when :repeat_key then fresh_sample? && repeated?(@keys_held[args[0]] || 0)
    when :release_key then fresh_sample? && @keys_released.include?(args[0])
    when :dir4 then direction4
    when :dir8 then direction8
    when :gets then take_text
    end
  end

  def self.direction4
    held = DIRECTIONS.select { |direction| @held[direction] }
    return 0 if held.empty?
    held.min { |a, b| @held[a] <=> @held[b] }
  end

  def self.direction8
    held = DIRECTIONS.select { |direction| @held[direction] }
    held.size == 2 && DIAGONALS[held] ? DIAGONALS[held] : direction4
  end

  def self.take_text
    text = @text
    @text = ""
    text
  end

  def self.install_input_hooks
    singleton = class << Input; self; end
    hook("Input.update") do
      singleton.send(:alias_method, :anil_bridge_input_update, :update)
      singleton.send(:define_method, :update) do |*args|
        AnilBridge.input_updated
        anil_bridge_input_update(*args)
      end
    end
    INPUT_WRAPPERS.each do |name, query|
      next unless Input.respond_to?(name)
      hook("Input.#{name}") do
        original = "anil_bridge_#{query}"
        singleton.send(:alias_method, original, name)
        singleton.send(:define_method, name) do |*args|
          AnilBridge.driven? ? AnilBridge.input_query(query, args) : AnilBridge.observe_input(query, args, send(original, *args))
        end
      end
    end
  end

  def self.frame_count_assigned(value)
    @frame_offset = value - @tick
  end

  def self.sync_frame_count
    Graphics.anil_bridge_set_frame_count(@tick + @frame_offset)
  end

  def self.creation_stamp
    STAMP_EPOCH + Graphics.frame_count / Graphics.frame_rate
  end

  def self.install_stamp_hooks
    hook("Pokemon creation stamps") do
      Pokemon.class_eval do
        alias_method :anil_bridge_initialize, :initialize
        def initialize(*args, **kwargs, &block)
          anil_bridge_initialize(*args, **kwargs, &block)
          @timeReceived = AnilBridge.creation_stamp
        end

        alias_method :anil_bridge_set_time_egg_hatched, :timeEggHatched=
        def timeEggHatched=(value)
          anil_bridge_set_time_egg_hatched(value.nil? ? value : AnilBridge.creation_stamp)
        end
      end
    end
  end
end

module Graphics
  class << self
    alias_method :anil_bridge_set_frame_count, :frame_count=
    def frame_count=(value)
      AnilBridge.frame_count_assigned(value)
      anil_bridge_set_frame_count(value)
    end
  end
end
