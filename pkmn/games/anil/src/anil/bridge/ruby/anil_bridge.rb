require "socket"

module AnilBridge
  PROTOCOL = 1
  LAUNCH_FILE = "anil_launch.json"
  FALLBACK_LOG = "anil_bridge.log"
  HOST = "127.0.0.1"
  RECV_CHUNK = 65536
  BRIDGE_FILE = __FILE__
  LOGGED_RESULT_CHARS = 500
  RECORDED_RESULT_CHARS = 4000
  SAVE_REFUSED_MESSAGE = "Esta copia de Añil solo guarda la partida bajo anil run. No se ha guardado nada."

  @server = nil
  @clients = []
  @tick = 0
  @launch = {}
  @client_ids = 0
  @serving = false
  @rng_calls = 0
  @seed = nil
  @pinning = false
  @refusing_saves = false
  @served_frames = []
  @served_payloads = []
  RESEED_MULTIPLIER = 1000003

  def self.pid
    Process.pid
  end

  def self.log(message)
    path = @launch["bridge_log"] || FALLBACK_LOG
    File.open(path, "a") { |file| file.puts("#{Time.now.strftime('%Y-%m-%d %H:%M:%S')} tick=#{@tick} #{message}") }
  rescue Exception
    nil
  end

  def self.log_exception(where, error)
    trace = (error.backtrace || [])[0, 8].join(" | ")
    log("exception in #{where}: #{error.class}: #{error.message} at #{trace}")
  end

  def self.start
    @launch = AnilJSON.decode(File.open(LAUNCH_FILE, "rb") { |file| file.read })
    start_muted
    log("start ruby=#{RUBY_VERSION} protocol=#{PROTOCOL} build=#{AnilVersion::BUILD} bridge_hash=#{AnilVersion::BRIDGE_HASH} session=#{@launch['session']} pid=#{pid}")
    log("save=#{@launch['save_dir']} clock=#{@launch['clock'].inspect} seed=#{@launch['seed']}")
    redirect_saves if save_dir
    seed_rng(@launch["seed"]) if @launch["seed"]
    if @launch["snapshot"]
      start_boot(@launch["snapshot"])
    else
      @boot_hold = true
      open_server(@launch["port"])
    end
  rescue Exception => error
    log_exception("start", error)
  ensure
    refuse_saves unless save_dir
  end

  def self.seed_rng(seed)
    @seed = seed
    Kernel.srand(seed)
  end

  def self.srand_args(args)
    return args unless args.empty? && @seed
    reseed = (@seed * RESEED_MULTIPLIER + @tick) & 0xffffffff
    log("bare srand reseeded with #{reseed}")
    [reseed]
  end

  def self.pin(name)
    return if @pinning
    @pinning = true
    begin
      yield
      log("pinned #{name}")
    ensure
      @pinning = false
    end
  rescue Exception => error
    log_exception("pin #{name}", error)
  end

  def self.save_dir
    @launch.is_a?(Hash) ? @launch["save_dir"] : nil
  end

  def self.refusing_saves?
    @refusing_saves
  end

  def self.clock_pinned?
    @launch["clock"].is_a?(Array)
  end

  def self.now
    Time.local(*@launch["clock"])
  end

  def self.redirect_saves
    pin("System.data_directory") do
      folder = "#{save_dir}\\"
      (class << System; self; end).send(:define_method, :data_directory) { folder }
    end
  end

  def self.refuse_saves
    @refusing_saves = true
    pin("System.data_directory (saves refused)") do
      folder = "#{Dir.pwd.tr('/', '\\')}\\"
      (class << System; self; end).send(:define_method, :data_directory) { folder }
    end
    log("no save folder in #{LAUNCH_FILE}: saves refused, data directory moved to the game folder")
  end

  def self.refuse_save
    log("save refused: no save folder")
    pbMessage(SAVE_REFUSED_MESSAGE) if defined?(pbMessage)
    false
  rescue Exception => error
    log_exception("refuse_save", error)
    false
  end

  def self.install_save_refusal
    return unless refusing_saves?
    hook("Game.save refusal") do
      Game.singleton_class.send(:define_method, :save) { |*args, **kwargs| AnilBridge.refuse_save }
    end
    hook("SaveData.save_to_file refusal") do
      SaveData.singleton_class.send(:define_method, :save_to_file) do |*args|
        raise IOError, "the bridge refuses saves without a save folder"
      end
    end
  end

  def self.open_server(port)
    @server = TCPServer.new(HOST, port)
    log("listening on #{HOST}:#{port}")
  rescue Exception => error
    @server = nil
    log("listen on #{HOST}:#{port} failed: #{error.class}: #{error.message}")
  end

  def self.poll
    @tick += 1
    advance_uptime
    sync_frame_count
    install_game_hooks unless @game_hooks
    record_owner_input
    observe_stack(caller)
    finish_restore if @restore && @restore[:done] && !@serving
    return if @server.nil? || @serving
    @serving = true
    @served_frames = @frames
    @served_payloads = payloads
    begin
      step_advance
      accept_clients
      @clients.dup.each { |client| serve(client) }
      wait_for_driver
    ensure
      @serving = false
    end
  rescue Exception => error
    log_exception("poll", error)
  end

  def self.accept_clients
    loop do
      io = @server.accept_nonblock(exception: false)
      return if io == :wait_readable
      @client_ids += 1
      @clients << { :io => io, :sock => @client_ids, :pending => "".b, :greeted => false }
      log("client #{@client_ids} connected (#{@clients.size} open)")
    end
  end

  def self.close_client(client, reason)
    begin
      client[:io].close
    rescue Exception
      nil
    end
    @clients.delete(client)
    release_role(client)
    release_pause(client)
    log("client #{client[:sock]} closed: #{reason} (#{@clients.size} open)")
  end

  def self.serve(client)
    loop do
      begin
        data = client[:io].read_nonblock(RECV_CHUNK, exception: false)
      rescue Exception => error
        close_client(client, "#{error.class}: #{error.message}")
        return
      end
      break if data == :wait_readable
      if data.nil?
        close_client(client, "peer closed")
        return
      end
      client[:pending] << data
    end
    while !held?(client) && (newline = client[:pending].index("\n"))
      line = client[:pending].slice!(0, newline + 1).strip
      next if line.empty?
      answer = handle(client, line)
      next if answer.nil?
      return unless send_line(client, AnilJSON.encode(answer) + "\n")
    end
  end

  def self.send_line(client, data)
    client[:io].write(data)
    true
  rescue Exception => error
    close_client(client, "send failed: #{error.class}: #{error.message}")
    false
  end

  def self.handle(client, line)
    request = nil
    request = AnilJSON.decode(line)
    raise ArgumentError, "request is not an object" unless request.is_a?(Hash)
    command = request["cmd"]
    raise ArgumentError, "the first request must be hello" if !client[:greeted] && command != "hello"
    check_since(request)
    result = case command
             when "hello" then hello(client, request)
             when "eval" then evaluate(client, request)
             when "stack" then stack
             when "shot" then shot
             when "rng" then { "calls" => @rng_calls }
             when "read" then read(request)
             when "advance" then start_advance(client, request)
             when "control" then control(client, request)
             when "speed" then speed_command(client, request)
             when "pause" then pause_command(client, request)
             when "sound" then sound_command(client, request)
             when "status" then status
             when "snapshot" then snapshot_command(client, request)
             when "note" then note(client, request)
             else raise ArgumentError, "unknown command #{command.inspect}"
             end
    log("client #{client[:sock]} request id=#{request['id'].inspect} cmd=#{command} ok")
    return nil if command == "advance" || command == "snapshot"
    reply(request, true, result, nil)
  rescue Exception => error
    log_exception("request #{line[0, 200].inspect} from client #{client[:sock]}", error)
    reply(request, false, nil, "#{error.class}: #{error.message}")
  end

  def self.reply(request, ok, result, error)
    events, gap = events_since(request)
    {
      "id" => request.is_a?(Hash) ? request["id"] : nil,
      "tick" => @tick,
      "ok" => ok,
      "result" => result,
      "error" => error,
      "events" => events,
      "events_gap" => gap,
      "caller" => @served_frames,
      "payloads" => @served_payloads,
      "digest" => digest
    }
  end

  def self.hello(client, request)
    claim_role(client, request["role"])
    client[:greeted] = true
    client[:name] = request["client"]
    handshake = {
      "protocol" => PROTOCOL,
      "bridge_hash" => AnilVersion::BRIDGE_HASH,
      "build" => AnilVersion::BUILD,
      "pid" => pid,
      "tick" => @tick,
      "session" => @launch["session"],
      "role" => client[:role],
      "snapshot" => booted_snapshot,
      "event_seq" => @event_seq
    }
    log("handshake with client #{client[:sock]} (#{request['client'].inspect}): #{AnilJSON.encode(handshake)}")
    handshake
  end

  def self.count_rng
    @rng_calls += 1
  end

  def self.session_path(name)
    "#{@launch['session_dir']}\\#{name}"
  end

  def self.clip(text, limit)
    text.length > limit ? "#{text[0, limit]}... (#{text.length} chars)" : text
  end

  def self.evaluate(client, request)
    source = request["source"]
    raise ArgumentError, "eval needs a source string" unless source.is_a?(String)
    started = @tick
    begin
      value = eval(source, TOPLEVEL_BINDING.eval("proc { binding }").call, "anil_eval", 1)
      result = { "class" => value.class.name, "inspect" => value.inspect }
    rescue Exception => raised
      record_eval(client, started, source, nil, "#{raised.class}: #{raised.message}")
      raise raised
    end
    record_eval(client, started, source, result, nil)
    result
  end

  def self.record_eval(client, started, source, result, error)
    outcome = error ? "error #{error}" : "=> #{clip(result['inspect'], LOGGED_RESULT_CHARS)}"
    log("client #{client[:sock]} eval at tick #{started} #{source.inspect} #{outcome}")
    record("eval", {
      "tick" => started,
      "end" => @tick,
      "client" => client[:name],
      "source" => source,
      "ok" => error.nil?,
      "class" => result && result["class"],
      "inspect" => result && clip(result["inspect"], RECORDED_RESULT_CHARS),
      "error" => error,
      "digest" => digest
    })
  end

  def self.status
    {
      "speed" => @speed,
      "renders" => @renders,
      "paused" => paused?,
      "muted" => muted?,
      "owner" => @owner_control,
      "driver" => !@driver.nil?,
      "driven" => driven?,
      "restoring" => restoring?,
      "clients" => @clients.size
    }
  end

  def self.stack
    { "frames" => game_frames(caller) }
  end

  def self.shot
    name = "shot-#{@tick}.bmp"
    bitmap = Graphics.snap_to_bitmap
    begin
      bitmap.to_file(session_path(name))
    ensure
      bitmap.dispose
    end
    log("screenshot #{name}")
    { "file" => name }
  end
end

module Kernel
  alias_method :anil_bridge_rand, :rand
  def rand(*args)
    AnilBridge.count_rng
    anil_bridge_rand(*args)
  end
  private :rand

  class << self
    alias_method :anil_bridge_rand, :rand
    def rand(*args)
      AnilBridge.count_rng
      anil_bridge_rand(*args)
    end
  end
end

module Kernel
  alias_method :anil_bridge_srand, :srand
  def srand(*args)
    anil_bridge_srand(*AnilBridge.srand_args(args))
  end
  private :srand

  class << self
    alias_method :anil_bridge_srand, :srand
    def srand(*args)
      anil_bridge_srand(*AnilBridge.srand_args(args))
    end
  end
end

class Object
  def self.method_added(name)
    return unless equal?(Object)
    if name == :pbGetTimeNow && AnilBridge.clock_pinned?
      AnilBridge.pin("pbGetTimeNow") do
        Object.send(:define_method, :pbGetTimeNow) { AnilBridge.now }
        Object.send(:private, :pbGetTimeNow)
      end
    elsif name == :pbCallTitle && AnilBridge.boot_snapshot?
      AnilBridge.pin("pbCallTitle") do
        Object.send(:alias_method, :anil_bridge_call_title, :pbCallTitle)
        Object.send(:define_method, :pbCallTitle) { AnilBridge.boot_scene || anil_bridge_call_title }
        Object.send(:private, :pbCallTitle, :anil_bridge_call_title)
      end
    end
  end
end

module Graphics
  class << self
    alias_method :anil_bridge_update, :update
    def update(*args)
      anil_bridge_update(*args) if AnilBridge.render_due?
      AnilBridge.poll
    end
  end
end

AnilBridge.start
