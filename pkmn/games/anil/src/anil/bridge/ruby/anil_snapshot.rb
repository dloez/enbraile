module AnilBridge
  SNAPSHOT_FILE = __FILE__
  SNAPSHOT_NAME = /\A[A-Za-z0-9_-]+\z/
  SNAPSHOT_SAVE = "save.dat"
  SNAPSHOT_INFO = "snapshot.json"
  SNAPSHOT_ACTIONS = ["save", "restore"]
  SEED_RANGE = 4294967296
  UPDATE_WRAPPER_FRAME = /\A\[(Intro Versus|Lens of truth|Discord Rich Presence API)\] [^:]+:\d+:in `update'\z/
  MAP_MAIN_FRAME = /\A411:Debug Passability:\d+:in `block in main'\z/

  @restore = nil
  @boot_snapshot = nil
  @booted_snapshot = nil
  @boot_hold = false

  def self.restoring?
    !@restore.nil?
  end

  def self.holding?
    driven? || (@boot_hold && @driver.nil? && !@owner_control)
  end

  def self.end_boot_hold
    @boot_hold = false
  end

  def self.boot_snapshot?
    !@boot_snapshot.nil?
  end

  def self.booted_snapshot
    @booted_snapshot
  end

  def self.snapshot_command(client, request)
    unless client[:role] == DRIVER_ROLE || client[:role] == CONTROL_ROLE
      raise ArgumentError, "snapshots need a client with the driver or control role"
    end
    action = request["action"]
    raise ArgumentError, "snapshot action must be save or restore, not #{action.inspect}" unless SNAPSHOT_ACTIONS.include?(action)
    name = request["name"]
    raise ArgumentError, "a snapshot name may hold only letters, digits, - and _, not #{name.inspect}" unless name.is_a?(String) && name =~ SNAPSHOT_NAME
    seed = request["seed"]
    raise ArgumentError, "seed must be an integer from 0 to #{SEED_RANGE - 1}" unless seed.nil? || (seed.is_a?(Integer) && seed >= 0 && seed < SEED_RANGE)
    raise ArgumentError, "snapshots need a pinned clock; this session runs on the real clock" unless clock_pinned?
    raise ArgumentError, "a snapshot restore is already running" if @restore
    raise ArgumentError, "an advance is running" if @advance
    raise ArgumentError, "the game is paused; resume it first" if paused?
    problem = idle_problem
    raise ArgumentError, "cannot #{action} a snapshot now: #{problem}" if problem
    if action == "save"
      take_snapshot(client, request, name, seed)
    else
      info, data = load_snapshot(name)
      begin_restore(client, request, info, data, seed, "restore")
    end
    nil
  end

  def self.idle_problem
    return "the game is not on the map" unless $scene.is_a?(Scene_Map)
    return "a battle is running" if @battle
    return "a #{@payloads.last['kind']} is open" unless @payloads.empty?
    return "an event is running" if $game_system.map_interpreter.running?
    return "a message is showing" if $game_temp.message_window_showing
    return "the menu is being called" if $game_temp.menu_calling
    return "a map transfer is pending" if $game_temp.player_transferring
    return "a transition is pending" if $game_temp.transition_processing
    main = @frames.index { |frame| frame =~ MAP_MAIN_FRAME }
    if main.nil? || !@frames[0, main].all? { |frame| frame =~ UPDATE_WRAPPER_FRAME }
      return "the map is not idle (#{@frames.find { |frame| frame !~ UPDATE_WRAPPER_FRAME }})"
    end
    nil
  end

  def self.snapshot_path(name, file = nil)
    folder = "#{@launch['snapshots_dir']}\\#{name}"
    file ? "#{folder}\\#{file}" : folder
  end

  def self.crc_hex(data)
    format("%08x", Zlib.crc32(data))
  end

  def self.take_snapshot(client, request, name, seed)
    begin
      Dir.mkdir(snapshot_path(name))
    rescue Errno::EEXIST
      raise ArgumentError, "a snapshot named #{name} already exists"
    end
    data = dump_save
    seed ||= Kernel.anil_bridge_rand(SEED_RANGE)
    File.open(snapshot_path(name, SNAPSHOT_SAVE), "wb") { |file| file.write(data) }
    info = {
      "name" => name, "seed" => seed, "tick" => @tick, "uptime" => @uptime, "speed" => @speed, "rng" => @rng_calls, "clock" => @launch["clock"],
      "hash" => crc_hex(data), "bytes" => data.length, "position" => position,
      "session" => @launch["session"], "build" => AnilVersion::BUILD, "bridge_hash" => AnilVersion::BRIDGE_HASH,
      "taken" => Time.now.strftime("%Y-%m-%dT%H:%M:%S")
    }
    File.open(snapshot_path(name, SNAPSHOT_INFO), "wb") { |file| file.write(AnilJSON.encode(info)) }
    log("snapshot #{name} taken: #{data.length} bytes, hash #{info['hash']}, seed #{seed}")
    record("snapshot", "name" => name, "hash" => info["hash"], "seed" => seed, "client" => client[:name], "id" => request["id"])
    begin_restore(client, request, info, data, nil, "save")
  end

  def self.dump_save
    $game_system.magic_number = $data_system.magic_number
    safesave = $PokemonGlobal.safesave
    $PokemonGlobal.safesave = true
    begin
      Marshal.dump(SaveData.compile_save_hash)
    ensure
      $PokemonGlobal.safesave = safesave
    end
  end

  def self.load_snapshot(name)
    info = AnilJSON.decode(File.open(snapshot_path(name, SNAPSHOT_INFO), "rb") { |file| file.read })
    data = File.open(snapshot_path(name, SNAPSHOT_SAVE), "rb") { |file| file.read }
    raise ArgumentError, "snapshot #{name} changed since it was taken (hash #{crc_hex(data)}, not #{info['hash']})" unless crc_hex(data) == info["hash"]
    [info, data]
  rescue Errno::ENOENT
    raise ArgumentError, "no snapshot named #{name}"
  end

  def self.begin_restore(client, request, info, data, seed, kind)
    save_data = Marshal.load(data)
    @restore = {
      :client => client, :request => request, :info => info, :save_data => save_data,
      :seed => seed.nil? ? info["seed"] : seed, :kind => kind, :from => @tick, :done => false, :error => nil
    }
    client[:waiting] = true if client
    $scene = AnilRestoreScene.new
  end

  def self.do_restore
    restore = @restore
    info = restore[:info]
    @tick = info["tick"]
    restore_uptime(info["uptime"])
    @rng_calls = info["rng"]
    @launch["clock"] = info["clock"]
    seed_rng(restore[:seed])
    clear_input
    $game_temp = Game_Temp.new
    load_save(restore[:save_data])
    start_discord_presence if restore[:kind] == "boot"
    client = restore[:client]
    record("restore", {
      "name" => info["name"], "hash" => info["hash"], "seed" => restore[:seed], "via" => restore[:kind],
      "from" => restore[:from], "client" => client && client[:name], "id" => restore[:request] && restore[:request]["id"]
    })
    log("snapshot #{info['name']} restored (#{restore[:kind]}) at tick #{@tick} with seed #{restore[:seed]}")
  rescue Exception => error
    log_exception("restore", error)
    restore[:error] = "#{error.class}: #{error.message}"
  ensure
    restore[:done] = true
    $scene = restore[:error] && $game_map.nil? ? pbCallTitle : Scene_Map.new
  end

  def self.load_save(save_data)
    SaveData.load_values(save_data)
    tm_compatibility = $PokemonGlobal.tm_compatibility_random
    reset_tm_moves
    Game.load(save_data)
    keep_tm_compatibility(tm_compatibility)
    $PokemonGlobal.safesave = false
    ChallengeModes.begin_challenge if ChallengeModes.running? && !$PokemonGlobal.challenge_rules.empty?
  end

  def self.reset_tm_moves
    load_data("Data/#{GameData::Item::DATA_FILENAME}").each do |id, item|
      live = GameData::Item::DATA[id]
      live.instance_variable_set(:@move, item.instance_variable_get(:@move)) if live
    end
  end

  def self.keep_tm_compatibility(table)
    return unless RandomizedChallenge.tm_compat_on?
    $PokemonGlobal.tm_compatibility_random = table
    RandomizedChallenge.save_tm_compatibility_data(table || {})
  end

  def self.start_discord_presence
    $DiscordRPC.start_rich_presence if $DiscordRPC && !$joiplay
  end

  def self.finish_restore
    restore = @restore
    @restore = nil
    info = restore[:info]
    client = restore[:client]
    if client.nil?
      @booted_snapshot = restore[:error] ? nil : info["name"]
      @boot_hold = restore[:error].nil?
      open_server(@launch["port"])
      return
    end
    client[:waiting] = false
    return unless @clients.include?(client)
    @served_frames = @frames
    @served_payloads = payloads
    result = { "name" => info["name"], "seed" => restore[:seed], "hash" => info["hash"], "tick" => info["tick"], "via" => restore[:kind] }
    ok = restore[:error].nil?
    answer = reply(restore[:request], ok, ok ? result : nil, restore[:error])
    send_line(client, AnilJSON.encode(answer) + "\n")
  end

  def self.boot_scene
    boot = @boot_snapshot
    return nil if boot.nil?
    @boot_snapshot = nil
    begin
      info, data = load_snapshot(boot["name"])
      raise ArgumentError, "snapshot #{boot['name']} has hash #{info['hash']}, not #{boot['hash']}" unless info["hash"] == boot["hash"]
      start_speed(info["speed"])
      begin_restore(nil, nil, info, data, boot["seed"], "boot")
    rescue Exception => error
      log_exception("boot snapshot #{boot['name']}", error)
      open_server(@launch["port"])
      nil
    end
  end

  def self.start_boot(snapshot)
    @boot_snapshot = snapshot
    log("boot snapshot #{snapshot['name']} (hash #{snapshot['hash']}, seed #{snapshot['seed']}); listening after the restore")
  end

  def self.install_snapshot_hooks
    hook("Scene_Map#update") do
      Scene_Map.class_eval do
        alias_method :anil_bridge_map_update, :update
        def update
          anil_bridge_map_update unless AnilBridge.restoring?
        end
      end
    end
  end
end

class AnilRestoreScene
  def main
    AnilBridge.do_restore
  end
end
