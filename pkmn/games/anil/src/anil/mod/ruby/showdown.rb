module RandomlockeShowdown
  LEVEL = 50
  EV = 1
  MAX_IV = 31
  STATS = [
    [:HP, "HP"], [:ATTACK, "Atk"], [:DEFENSE, "Def"],
    [:SPECIAL_ATTACK, "SpA"], [:SPECIAL_DEFENSE, "SpD"], [:SPEED, "Spe"]
  ]
  GENDERS = { 0 => " (M)", 1 => " (F)" }
  KINDS = {
    species: ["especie", RandomlockeShowdownNames::SPECIES],
    item: ["objeto", RandomlockeShowdownNames::ITEMS],
    ability: ["habilidad", RandomlockeShowdownNames::ABILITIES],
    move: ["movimiento", RandomlockeShowdownNames::MOVES],
    nature: ["naturaleza", RandomlockeShowdownNames::NATURES]
  }
  KEY_LABEL = "[Z] Exportar a Showdown"
  LINE_HEIGHT = 30
  TEXT_OFFSET = 20
  TEXT_X = 24
  BOX_ZOOM_X = 1.45
  COPIED = "Tu equipo se ha copiado al portapapeles en el formato de Pokémon Showdown. " \
           "Pégalo en el editor de equipos de Showdown con Import from text or URL."
  EMPTY = "No hay ningún Pokémon que exportar."
  MISSING = "No se pudo exportar el equipo: {1} no tiene nombre en Pokémon Showdown. " \
            "No se ha copiado nada."

  class MissingName < StandardError; end

  def self.lookup(kind, id)
    label, names = KINDS[kind]
    names[id] || raise(MissingName, "#{label} #{id}")
  end

  def self.species_id(pokemon)
    GameData::Species.get_species_form(pokemon.species, pokemon.form).id
  end

  def self.nature_id(pokemon)
    pokemon.nature_for_stats.id
  end

  def self.iv(pokemon, stat)
    pokemon.ivMaxed[stat] ? MAX_IV : pokemon.iv[stat]
  end

  def self.set(pokemon)
    species = lookup(:species, species_id(pokemon))
    head = pokemon.nicknamed? ? "#{pokemon.name} (#{species})" : species
    head += GENDERS.fetch(pokemon.gender, "")
    head += " @ #{lookup(:item, pokemon.item_id)}" if pokemon.item_id
    lines = [head, "Ability: #{lookup(:ability, pokemon.ability_id)}", "Level: #{LEVEL}"]
    lines << "EVs: " + STATS.map { |_, label| "#{EV} #{label}" }.join(" / ")
    lines << "#{lookup(:nature, nature_id(pokemon))} Nature"
    ivs = STATS.filter_map { |stat, label| "#{iv(pokemon, stat)} #{label}" if iv(pokemon, stat) < MAX_IV }
    lines << "IVs: " + ivs.join(" / ") unless ivs.empty?
    pokemon.moves.each { |move| lines << "- #{lookup(:move, move.id)}" }
    lines.join("\n") + "\n"
  end

  def self.export(party = $player.party)
    party.compact.reject { |pokemon| pokemon.egg? || pokemon.perma_faint }.map { |pokemon| set(pokemon) }.join("\n")
  end

  def self.copy
    text = export
    return pbMessage(_INTL(EMPTY)) if text.empty?
    Input.clipboard = text
    Randomlocke.log("randomlocke showdown export copied: #{text.length} characters")
    pbMessage(_INTL(COPIED))
  rescue MissingName => error
    Randomlocke.log("randomlocke showdown export refused: #{error.message}")
    pbMessage(_INTL(MISSING, error.message))
  end
end

Randomlocke.after_plugins do
  class DP_PauseMenu
    alias_method :randomlocke_draw_helpful_text, :draw_helpful_text
    def draw_helpful_text
      randomlocke_draw_helpful_text
      top = @sprites[:infoTop].y
      [@sprites[:infoTop], @sprites[:infoMid]].each { |sprite| sprite.y -= RandomlockeShowdown::LINE_HEIGHT }
      @sprites[:infoMid].zoom_y += RandomlockeShowdown::LINE_HEIGHT
      [:infoTop, :infoMid, :infoBtm].each { |key| @sprites[key].zoom_x = RandomlockeShowdown::BOX_ZOOM_X }
      @sprites[:showdown_txt] = TextSprite.new(@viewport2)
      @sprites[:showdown_txt].draw([
        [RandomlockeShowdown::KEY_LABEL, RandomlockeShowdown::TEXT_X,
         top - RandomlockeShowdown::LINE_HEIGHT + RandomlockeShowdown::TEXT_OFFSET,
         0, DP_PauseMenu::BaseColor, DP_PauseMenu::ShadowColor, true]
      ])
    end

    alias_method :randomlocke_update, :update
    def update
      randomlocke_update
      return unless Input.trigger?(Input::ACTION)
      pbPlayDecisionSE
      RandomlockeShowdown.copy
      Input.update
    end
  end
end
