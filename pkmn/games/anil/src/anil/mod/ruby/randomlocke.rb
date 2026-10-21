module Randomlocke
  VERSION = RandomlockeVersion::VERSION
  TITLE = "Pokémon Añil Randomlocke v#{VERSION}"
  OFFICIAL_CRC32 = {
    "Data/Scripts.rxdata" => 1864363062,
    "Data/PluginScripts.rxdata" => 1419385020
  }
  SELF_CHECK_WARNING = "Aviso de la Randomlocke: esta copia no es la versión oficial de Pokémon Añil v4.14 " \
                       "(archivos cambiados: %s). Las reglas de la Randomlocke pueden no funcionar. " \
                       "Vuelve a descargar el juego de la Randomlocke y no le apliques parches ni actualizaciones."
  ALLOW_LIST_ERROR = "Error de la Randomlocke: las listas permitidas tienen nombres que no existen en el juego " \
                     "(%s). Vuelve a generar las listas permitidas de la Randomlocke."
  PC_MENU_MESSAGE = "Los modos de juego de esta partida ya están fijados por la Randomlocke. " \
                    "Puedes ver sus reglas en el Libro de Reglas de tu mochila."

  CHALLENGE_RULES = [
    :PERMAFAINT,
    :HEALING_ITEMS_PURCHASE, :BATTLE_ITEMS_PURCHASE, :VITAMINS_PURCHASE,
    :ONE_CAPTURE, :FIRST_CAPTURE, :GIFT_CLAUSE, :SHINY_CLAUSE, :DUPS_CLAUSE, :LEGENDARY_CLAUSE,
    :FORCE_NICKNAME,
    :FORCE_SET_BATTLES
  ]
  RANDOM_FLAGS = {
    random_enabled: true,
    progressive_random: true,
    randomize_pokemon: true,
    consistent_wild_encounters: true,
    enable_random_moves: true,
    prioritize_stab_in_learnset: true,
    different_movesets_per_form: true,
    banohko: true,
    enable_random_tm_compat: true,
    enable_random_types: false,
    enable_random_evolutions: false,
    enable_random_evolutions_similar_bst: false,
    enable_random_evolutions_respect_restrictions: false,
    randomize_items: true,
    randomize_held_items: true,
    randomize_trainers: true,
    remember_trainer_teams: true,
    randomize_trainers_items: true,
    randomize_starters: true,
    semi_random_mode: false
  }
  RANDOM_GENS = [1, 2, 3, 4, 5]
  ABILITY_MODE = :FULLRANDOM
  RANDOMIZER_RULES = {
    PROGRESSIVE_RANDOM: true,
    RANDOMIZE_POKEMON: true,
    CONSISTENT_ENCOUNTERS: true,
    RANDOMIZE_MOVES: true,
    PRIORIZE_STAB_IN_LEARNSET: true,
    DIFFERENT_MOVESETS_PER_FORM: true,
    BAN_OHKO: true,
    RANDOMIZE_TM_COMPATIBILITY: true,
    RANDOMIZE_ABILITIES: ABILITY_MODE,
    GENS: RANDOM_GENS.map { |gen| [:"GEN#{gen}", true] }.to_h,
    RANDOMIZE_TRAINERS: true,
    REMEMBER_TRAINER_TEAMS: true,
    RANDOMIZE_TRAINER_ITEMS: true,
    RANDOMIZE_ITEMS: true,
    RANDOMIZE_HELD_ITEMS: true
  }

  SET_STYLE = 1
  WILD_HIDDEN = 1
  COMPLETO_SWITCH = 110
  INTRO_MAP = 1
  MODE_MENU_MAP = 104
  BEDROOM_TRANSFER = [0, 28, 29, 10, 2, 0]
  LAB_VARIABLES = { 76 => 31, 78 => 4, 79 => 8 }
  PLAYER_OPACITY = 255
  CLEAR_TONE = [0, 0, 0, 0]
  RULEBOOK = :RULEBOOK
  HIDDEN_OPTIONS = [:battle_style, :salvajes_visibles_en_ow]
  UPDATER_METHODS = [:check_for_updates, :validate_game_version, :validate_game_version_and_update]
  STARTER_LEVEL = 5
  STARTER_REGION_INDEX = 0
  STARTER_REGION_FIRST_SWITCH = 334
  MEGA_SWAP_LIMITED_SPECIES = [:ALCREMIE, :PIKACHU, :EEVEE, :FLOETTE]
  MEGA_SWAP_LIMITED_FORMS = [:PIKACHU_16, :EEVEE_1, :ALCREMIE, :FLOETTE_5]
  EGG_COUNT = 16
  EGG_STEPS = 100
  EGG_BOX_NAME = "Huevos"
  EGG_NAME = "Huevo"
  EGG_PLACEHOLDER = :TOGEPI

  @pinning = false
  @installed = false

  def self.log(message)
    if defined?(AnilBridge)
      AnilBridge.log(message)
    elsif defined?(MKXP) && MKXP.respond_to?(:puts)
      MKXP.puts("[randomlocke] #{message}")
    end
  rescue Exception
    nil
  end

  def self.log_exception(where, error)
    trace = (error.backtrace || [])[0, 8].join(" | ")
    log("randomlocke exception in #{where}: #{error.class}: #{error.message} at #{trace}")
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

  def self.updater_disabled(name)
    log("updater call #{name} skipped")
    nil
  end

  def self.after_plugins(&block)
    (@after_plugins ||= []) << block
  end

  def self.install
    return if @installed
    @installed = true
    self_check
    @after_plugins.each(&:call)
    restore_freeze
    HIDDEN_OPTIONS.each { |option| MenuHandlers.remove(:options_menu, option) }
    PokemonGlobalMetadata.send(:attr_accessor, :randomlocke_version)
    System.set_window_title(TITLE)
    log("randomlocke v#{VERSION} installed")
  rescue Exception => error
    log_exception("install", error)
    raise
  end

  def self.self_check
    changed = OFFICIAL_CRC32.reject do |path, crc|
      File.file?(path) && Zlib.crc32(File.binread(path)) == crc
    end.keys
    if changed.empty?
      log("randomlocke self-check passed")
    else
      log("randomlocke self-check failed: #{changed.join(', ')}")
      print(format(SELF_CHECK_WARNING, changed.join(", ")))
    end
  end

  def self.allow_lists
    {
      "especies" => [RandomlockeAllowLists::SPECIES, GameData::Species],
      "movimientos" => [RandomlockeAllowLists::MOVES, GameData::Move],
      "habilidades" => [RandomlockeAllowLists::ABILITIES, GameData::Ability],
      "tipos" => [RandomlockeAllowLists::TYPES.values.flatten.uniq, GameData::Type]
    }
  end

  def self.check_allow_lists
    lists = allow_lists
    unresolved = lists.map do |kind, (names, data)|
      missing = names.reject { |name| data.exists?(name) }
      missing.empty? ? nil : "#{kind}: #{missing.join(', ')}"
    end.compact
    unless unresolved.empty?
      log("randomlocke allow-lists failed: #{unresolved.join('; ')}")
      raise format(ALLOW_LIST_ERROR, unresolved.join("; "))
    end
    counts = lists.map { |kind, (names, _)| "#{names.length} #{kind}" }.join(", ")
    log("randomlocke allow-lists resolved: #{counts}")
  end

  def self.restore_types
    restored = RandomlockeAllowLists::TYPES.filter_map do |id, types|
      data = GameData::Species.get(id)
      next if data.types == types
      data.instance_variable_set(:@types, types.dup)
      id
    end
    log("randomlocke types restored: #{restored.length} species, #{restored.join(', ')}")
  end

  def self.restore_freeze
    Settings.send(:remove_const, :FREEZE_EFFECTS_CAUSE_FROSTBITE)
    Settings.const_set(:FREEZE_EFFECTS_CAUSE_FROSTBITE, false)
    statuses = GameData::Status::DATA.to_a
    GameData::Status::DATA.clear
    statuses.each do |id, status|
      if id == :FROSTBITE
        GameData::Status.register({
          id: :FROZEN, name: status.real_name, animation: status.animation, icon_position: status.icon_position
        })
      else
        GameData::Status::DATA[id] = status
      end
    end
    log("randomlocke freeze restored: statuses #{GameData::Status.keys.inspect}")
  end

  def self.allowed_species
    @allowed_species ||= Set.new(RandomlockeAllowLists::SPECIES)
  end

  def self.allowed_species?(species)
    data = GameData::Species.try_get(species)
    !data.nil? && allowed_species.include?(data.id)
  end

  def self.allowed_forms
    @allowed_forms ||= RandomlockeAllowLists::SPECIES.group_by { |id| GameData::Species.get(id).species }
  end

  def self.cap_form(pokemon)
    return if allowed_species?(pokemon.species_data.id)
    allowed = allowed_forms[pokemon.species]
    return unless allowed
    form = GameData::Species.get(allowed.first).form
    log("randomlocke form capped: #{pokemon.species_data.id} to #{allowed.first}")
    pokemon.forced_form = form unless pokemon.forced_form.nil?
    pokemon.form_simple = form
  end

  def self.paused_draw?(species)
    return false if @keeping_species
    return false unless RandomizedChallenge.enabled? && RandomizedChallenge.randomize_pokemon?
    return false unless RandomizedChallenge.wild_paused? && RandomizedChallenge::WHITELISTED_POKEMON.empty?
    return false if RandomizedChallenge::UNRANDOMIZABLE_POKEMON.include?(species)
    !allowed_species?(species)
  end

  def self.paused_species(species)
    drawn = valid_random_species
    log("randomlocke paused species capped: #{species} to #{drawn.id}")
    drawn
  end

  def self.keeping_species
    previous = @keeping_species
    @keeping_species = true
    yield
  ensure
    @keeping_species = previous
  end

  def self.draw_species(with_mega)
    return GameData::Species.get(mega_swap_species.sample) if with_mega
    pool = RandomlockeAllowLists::SPECIES
    species = pool.sample
    count = RandomizedChallenge::MULTIPLE_FORM_POOL[GameData::Species.get(species).species]
    if count && rand(count) != 0
      while RandomizedChallenge::MULTIPLE_FORM_POOL.key?(GameData::Species.get(species).species)
        species = pool.sample
      end
    end
    GameData::Species.get(species)
  end

  def self.mega_swap_species
    @mega_swap_species ||= GameData::Species.keys.filter_map do |id|
      data = GameData::Species.get(id)
      next unless data.mega_stone
      next if MEGA_SWAP_LIMITED_SPECIES.include?(data.species) && !MEGA_SWAP_LIMITED_FORMS.include?(data.id)
      data.species if allowed_species?(data.species)
    end
  end

  def self.starter_species(type)
    pool = []
    GameData::Species.each_species do |species|
      next unless allowed_species?(species.id)
      next unless species.get_family_species.all? { |member| allowed_species?(member) }
      evolutions = species.get_family_evolutions
      next unless evolutions.size >= 2 && evolutions.one? { |evolution| evolution[0] == species.id }
      next if type && !species.types.include?(type)
      pool << species
    end
    pool
  end

  def self.generate_starters(type)
    variables = RandomizedChallenge::RANDOM_STARTER_VARIABLES
    starters = starter_species(type).sample(variables.length)
    RandomizedChallenge.pause_random_species
    variables.each_with_index do |variable, index|
      pokemon = Pokemon.new(starters[index], STARTER_LEVEL)
      pokemon.randomized = true
      pbSet(variable, pokemon)
    end
    RandomizedChallenge.resume_random_species
  end

  def self.draw_move(min_damage, types)
    typed_moves(min_damage, types).sample
  end

  def self.typed_moves(min_damage, types)
    moves = RandomlockeAllowLists::MOVES.map { |id| GameData::Move.get(id) }
    moves = moves.reject(&:ohko?) if RandomizedChallenge.ohko_banned?
    moves = moves.select { |move| move.display_max_power >= min_damage } if min_damage.positive?
    moves = moves.select { |move| types.include?(move.type) } unless types.empty?
    moves
  end

  def self.badge_window_allows?(move, progressive, badge_count)
    return true unless progressive
    if badge_count < MoveRandomizer::EARLY_GAME_BADGES
      move.display_max_power(true) <= MoveRandomizer::POWER_THRESHOLD
    elsif badge_count >= MoveRandomizer::LATE_GAME_BADGES
      !MoveRandomizer::LATE_GAME_BANNED_MOVES.include?(move.id)
    else
      true
    end
  end

  def self.cap_abilities
    exclusions = RandomizedChallenge::ABILITY_EXCLUSIONS
    capped = GameData::Ability.keys - RandomlockeAllowLists::ABILITIES - exclusions
    exclusions.concat(capped)
    log("randomlocke abilities capped: #{capped.length} excluded, #{exclusions.length} in all")
  end

  def self.applied?
    !!($PokemonGlobal && $PokemonGlobal.randomlocke_version)
  end

  def self.intro_transfer(parameters)
    return parameters unless $game_map && $game_map.map_id == INTRO_MAP
    return parameters unless parameters[0] == 0 && parameters[1] == MODE_MENU_MAP
    set_up_new_game unless applied?
    BEDROOM_TRANSFER.dup
  end

  def self.set_up_new_game
    answer_intro_menus
    queue_challenge
    enable_randomizer
    give_eggs
    $game_switches[Settings::NO_MEGA_EVOLUTION] = true
    $bag.add(RULEBOOK)
    $PokemonGlobal.randomlocke_version = VERSION
    log("randomlocke new game set up: challenge #{$PokemonGlobal.challenge_rules.inspect}, " \
        "gens #{$PokemonGlobal.random_gens.inspect}, abilities #{RandomizedChallenge.ability_mode}, " \
        "no mega #{$game_switches[Settings::NO_MEGA_EVOLUTION]}")
  rescue Exception => error
    log_exception("new game setup", error)
    raise
  end

  def self.answer_intro_menus
    $game_switches[COMPLETO_SWITCH] = true
    $PokemonSystem.battlestyle = SET_STYLE
    $PokemonSystem.salvajes_visibles_en_ow = WILD_HIDDEN
    LAB_VARIABLES.each { |id, value| $game_variables[id] = value }
    $player.has_running_shoes = true
    $game_system.menu_disabled = false
    $game_player.opacity = PLAYER_OPACITY
    $game_screen.start_tone_change(Tone.new(*CLEAR_TONE), 0)
  end

  def self.queue_challenge
    $PokemonGlobal.challenge_rules = CHALLENGE_RULES.dup
    $PokemonGlobal.challenge_qued = true
    $PokemonGlobal.challenge_encs = {}
  end

  def self.enable_randomizer
    global = $PokemonGlobal
    global.initialize_random_params(true)
    RANDOM_FLAGS.each { |name, value| global.public_send(:"#{name}=", value) }
    RandomizerConfigurator.gens = RANDOM_GENS
    RandomizerConfigurator.ability_mode = ABILITY_MODE
    global.randomizer_rules = Marshal.load(Marshal.dump(RANDOMIZER_RULES))
    generate_random_starters
    RandomizedChallenge.save_tm_compatibility_data(global.tm_compatibility_random)
  end

  def self.give_eggs
    box = $PokemonStorage.maxBoxes - 1
    $PokemonStorage.boxes[box].name = EGG_BOX_NAME
    EGG_COUNT.times { |index| $PokemonStorage[box, index] = new_egg }
    log("randomlocke eggs given: #{EGG_COUNT} in box #{box + 1} (#{EGG_BOX_NAME})")
  end

  def self.new_egg
    egg = Pokemon.new(EGG_PLACEHOLDER, Settings::EGG_LEVEL, $player, false, true, false)
    egg.randomlocke_egg = true
    egg.name = EGG_NAME
    egg.steps_to_hatch = EGG_STEPS
    egg.obtain_text = ""
    egg.calc_stats
    egg
  end

  def self.hatch_egg(egg)
    return unless egg.randomlocke_egg
    badges = $player.badge_count
    hatched = Pokemon.new(valid_random_species(badges), Settings::EGG_LEVEL, $player, true, true, false)
    cap_form(hatched)
    hatched.ensure_has_damaging_move!
    hatched.instance_variables.each { |name| egg.instance_variable_set(name, hatched.instance_variable_get(name)) }
    egg.send(:remove_instance_variable, :@randomlocke_egg)
    log("randomlocke egg drawn: #{egg.species_data.id} at #{badges} badges")
  end

  def self.choose_starter_region
    region, starters = PBEleccionStarters::STARTER_REGIONS[STARTER_REGION_INDEX]
    $game_switches[STARTER_REGION_FIRST_SWITCH + STARTER_REGION_INDEX] = true
    pbSet(PBEleccionStarters::CHOSEN_STARTERS, starters)
    log("randomlocke starter region set: #{region}")
    save_new_game
  end

  def self.save_new_game
    return unless $player.save_slot.nil?
    SaveData.get_manual_slots(true)
    slot = SaveData.get_new_manual_slot
    if File.exist?(SaveData.get_full_path(slot))
      log("randomlocke new game not saved: #{slot} already exists")
      return
    end
    log("randomlocke new game saved to #{slot}: #{Game.save(slot)}")
  rescue Exception => error
    log_exception("new game save", error)
  end

  def self.sync_tm_compatibility
    return unless applied? && RandomizedChallenge.tm_compat_on?
    RandomizedChallenge.save_tm_compatibility_data($PokemonGlobal.tm_compatibility_random || {})
  end
end

System.set_window_title(Randomlocke::TITLE)

module PokeUpdater
  def self.singleton_method_added(name)
    return unless Randomlocke::UPDATER_METHODS.include?(name)
    Randomlocke.pin("PokeUpdater.#{name}") do
      (class << self; self; end).send(:define_method, name) { |*args| Randomlocke.updater_disabled(name) }
    end
  end
end

class DiscordAPI
  def self.method_added(name)
    return unless name == :initialize
    Randomlocke.pin("DiscordAPI#initialize") do
      send(:define_method, :initialize) { |*args| nil }
      send(:private, :initialize)
    end
  end
end

module PluginManager
  def self.singleton_method_added(name)
    return unless name == :runPlugins
    Randomlocke.pin("PluginManager.runPlugins") do
      class << self
        alias_method :randomlocke_run_plugins, :runPlugins
        def runPlugins(*args)
          result = randomlocke_run_plugins(*args)
          Randomlocke.install
          result
        end
      end
    end
  end
end

Randomlocke.after_plugins do
  class Interpreter
    alias_method :randomlocke_command_201, :command_201
    def command_201
      @parameters = Randomlocke.intro_transfer(@parameters)
      randomlocke_command_201
    end
  end

  class PokemonSystem
    def battlestyle=(_value)
      @battlestyle = Randomlocke::SET_STYLE
    end

    def salvajes_visibles_en_ow=(_value)
      @salvajes_visibles_en_ow = Randomlocke::WILD_HIDDEN
    end
  end

  module Game
    class << self
      alias_method :randomlocke_set_up_system, :set_up_system
      def set_up_system(*args)
        Randomlocke.check_allow_lists
        Randomlocke.restore_types
        Randomlocke.cap_abilities
        randomlocke_set_up_system(*args)
      end

      alias_method :randomlocke_save, :save
      def save(*args, **options)
        result = randomlocke_save(*args, **options)
        Randomlocke.sync_tm_compatibility if result
        result
      end
    end
  end

  module CableClub
    class << self
      alias_method :randomlocke_parse_pkmn, :parse_pkmn
      def parse_pkmn(record)
        Randomlocke.keeping_species { randomlocke_parse_pkmn(record) }
      end
    end
  end

  class MostrarPokemonAnimado
    alias_method :randomlocke_mostrar_poke_animado, :mostrar_poke_animado
    def mostrar_poke_animado(*args)
      Randomlocke.keeping_species { randomlocke_mostrar_poke_animado(*args) }
    end
  end

  class Pokemon
    attr_accessor :randomlocke_egg

    alias_method :randomlocke_initialize, :initialize
    def initialize(species, level, owner = $player, withMoves = true, recheck_form = true, randomize = true)
      capped = randomize && Randomlocke.paused_draw?(species)
      species = Randomlocke.paused_species(species) if capped
      randomlocke_initialize(species, level, owner, withMoves, recheck_form, randomize)
      @randomized = true if capped
    end

    alias_method :randomlocke_check_evolution_internal, :check_evolution_internal
    def check_evolution_internal(&block)
      randomlocke_check_evolution_internal do |pokemon, new_species, *conditions|
        Randomlocke.allowed_species?(new_species) ? block.call(pokemon, new_species, *conditions) : nil
      end
    end
  end

  alias randomlocke_hatch pbHatch
  def pbHatch(pokemon)
    Randomlocke.hatch_egg(pokemon)
    randomlocke_hatch(pokemon)
  end

  alias randomlocke_mostrar_lista_starters pbMostrarListaStarters
  def pbMostrarListaStarters(*args)
    return randomlocke_mostrar_lista_starters(*args) unless Randomlocke.applied?
    Randomlocke.choose_starter_region
  end

  alias randomlocke_valid_pokemon? valid_pokemon?
  def valid_pokemon?(species, *conditions)
    Randomlocke.allowed_species?(species) && randomlocke_valid_pokemon?(species, *conditions)
  end

  alias randomlocke_process_trainer_pokemon process_trainer_pokemon
  def process_trainer_pokemon(pkmn, unrandomizable_species = nil, index = nil)
    pkmn = randomlocke_process_trainer_pokemon(pkmn, unrandomizable_species, index)
    Randomlocke.cap_form(pkmn) unless unrandomizable_species && unrandomizable_species[index]
    pkmn
  end

  def random_species(with_mega = false)
    Randomlocke.draw_species(with_mega)
  end

  def generate_random_starters(type = nil)
    type ||= MonotypeChallenge.type if defined?(MonotypeChallenge) && MonotypeChallenge.enabled?
    Randomlocke.generate_starters(type)
  end

  def random_move(min_damage = 0, types = [], _for_tm = false)
    Randomlocke.draw_move(min_damage, types)
  end

  alias randomlocke_find_valid_move find_valid_move
  def find_valid_move(min_damage = 0, types = [], for_tm = false, progressive = RandomizedChallenge.progressive?, badge_count = $player.badge_count)
    badge_count ||= $player&.badge_count || 0
    unless types.empty?
      open = Randomlocke.typed_moves(min_damage, types).any? do |move|
        Randomlocke.badge_window_allows?(move, progressive, badge_count) && !invalid_move?(move, move, for_tm)
      end
      unless open
        Randomlocke.log("randomlocke typed moves used up: #{types.inspect} at #{badge_count} badges, drawing from every type")
        types = []
      end
    end
    randomlocke_find_valid_move(min_damage, types, for_tm, progressive, badge_count)
  end

  def pbMostrarMenuCustomizacion
    pbMessage(_INTL(Randomlocke::PC_MENU_MESSAGE))
  end

  def pbSetWindowText(string)
    System.set_window_title(string || Randomlocke::TITLE)
  end
end
