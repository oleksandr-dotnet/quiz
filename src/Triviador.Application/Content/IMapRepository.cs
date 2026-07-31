using Triviador.Domain.Map;

namespace Triviador.Application.Content;

public interface IMapRepository
{
    MapDescriptor GetDefaultMap();

    string GetDefaultViewBox();
}
